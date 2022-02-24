#!/usr/bin/env node

const k8s = require("kubernetes-client");
const exec = require("child_process").spawn;
const readline = require("readline");
const Request = require("kubernetes-client/backends/request");
function uniq(list) {
  return list.reduce((acc, d) => (acc.includes(d) ? acc : acc.concat(d)), []);
}

const conf = new k8s.KubeConfig();
conf.loadFromDefault();

const ctxs = process.env["OC_TOOLS_CTXS"].split(";")

const apis = ctxs.reduce((acc, ctx) => {
  conf.setCurrentContext(ctx);
  const backend = new Request({ kubeconfig: conf });
  const client = new k8s.Client({ backend, version: "1.13" });
  acc[ctx] = client.api.v1;
  return acc;
}, {});

async function readPass() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.stdoutMuted = true;

    rl.question("Password: ", function (password) {
      rl.close();
      resolve(password);
    });

    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) rl.output.write("*");
      else rl.output.write(stringToWrite);
    };
  });
}

async function run() {
  let loginNeeded = [];
  for (ctx of ctxs) {
    try {
      conf.setCurrentContext(ctx);
      const ns = await apis[ctx].namespace("default").get();
    } catch (err) {
      if (err.code > 499) throw(err);
      loginNeeded.push(ctx);
    }
  }

  if (loginNeeded.length > 0) {
     console.log(`Login needed for ${loginNeeded}`);
    const pass = await readPass();
    for (ctx of ctxs) {
      const [_ns, host, user] = ctx.split("/");
      const host2 = host.replace(/-/g, ".");
      exec("oc", ["login", `https://${host2}`, "-u", user, "-p", pass],{stdio: "inherit"}, (err) => {
        if (err) throw (err);
      });
    }
} else {
  console.log(`Logged in to:\n${ctxs.map(c=> " - " + c).join("\n")}`);
}
}
run();
