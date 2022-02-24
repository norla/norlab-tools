#!/usr/bin/env node

const { AutoComplete } = require("enquirer");
const spawn = require("child_process").spawn;
const k8s = require("kubernetes-client");
const Request = require("kubernetes-client/backends/request");

const pattern = process.argv[2];
function uniq(list) {
  return list.reduce((acc, d) => (acc.includes(d) ? acc : acc.concat(d)), []);
}
const defaultConf = new k8s.KubeConfig();
defaultConf.loadFromDefault();

const ctxs = process.env["OC_TOOLS_CTXS"].split(";")

const apis = ctxs.reduce((acc, ctx) => {
  const conf = new k8s.KubeConfig();
  conf.loadFromDefault();
  conf.setCurrentContext(ctx);
  const backend = new Request({ kubeconfig: conf });
  const client = new k8s.Client({ backend, version: "1.13" });
  acc[ctx] = client.api.v1;
  return acc;
}, {});

const namespaces = {};
async function run() {
  const results = await Promise.all(
    Object.entries(apis).map(async ([ctx, api]) => {
      const res = await api.namespaces.get();
      if (res.statusCode !== 200)
        throw new Error(`Bad status code: ${res.statusCode}`);
      return res.body.items.forEach((i) => {
        const name = `${ctx} ${i.metadata.name}`;
        namespaces[name] = { ctx, ns: i.metadata.name };
      });
    })
  );

  const prompt = new AutoComplete({
    message: "Namespace",
    limit: 5,
    initial: 2,
    choices: Object.keys(namespaces),
  });

  const selectedNsName = await prompt.run();
  const selectedNs = namespaces[selectedNsName];
  const selectedApi = apis[selectedNs.ctx];
  const pods = await selectedApi.namespaces(selectedNs.ns).pods.get();

  const appLabels = pods.body.items.flatMap((item) =>
    Object.entries(item.metadata.labels).map(([k, v]) => `${k}=${v}`)
  );

  const prompt2 = new AutoComplete({
    message: "label",
    choices: uniq(appLabels),
  });

  const appLabel = await prompt2.run();
  console.log(selectedNs);
  const sternOpts = [
    "-n",
    selectedNs.ns,
    "-l",
    appLabel,
    "--context",
    selectedNs.ctx,
    "--tail",
    "200",
  ];

  if (pattern) {
    sternOpts.push("-i");
    sternOpts.push(pattern);
  }
  spawn("stern", sternOpts, {
    stdio: "inherit",
    detached: false,
  });
}

run();
