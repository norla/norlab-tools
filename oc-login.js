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

const ctxs = {
  elx: "default/console-elx-bonniernews-io:443/mattias.norlander",
  aws: "default/console-prod-bonniernews-io:443/mattias.norlander",
};

const apis = Object.entries(ctxs).reduce((acc, [ctxKey, ctxName]) => {
  conf.setCurrentContext(ctxName);
  const backend = new Request({ kubeconfig: conf });
  const client = new k8s.Client({ backend, version: "1.13" });
  acc[ctxKey] = client.api.v1;
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
  let loginNeeded = Object.keys(ctxs);
  // for (ctx in ctxs) {
  //   console.log("- - - DEBUG api", ctxs[ctx]);
  //   try {
  //     conf.setCurrentContext(ctxs[ctx]);
  //     const ns = await apis[ctx].namespace("default").get();
  //     // console.log("- - - DEBUG ns", ns);
  //   } catch (err) {
  //     if (err.code !== 401) throw(err);
  //     loginNeeded.push(ctx);
  //     console.log("- - - DEBUG err", JSON.stringify(err, null, 2));
  //   }
  // }

  if (loginNeeded.length > 0) {
     console.log(`Login needed for ${ctxs[loginNeeded]}`);
    const pass = await readPass();
    for (ctx in ctxs) {
      const [_ns, host, user] = ctxs[ctx].split("/");
      const host2 = host.replace(/-/g, ".");
      exec("oc", ["login", `https://${host2}`, "-u", user, "-p", pass],{stdio: "inherit"}, (err) => {
        if (err) throw (err);
      });
    }
} else {
  console.log("Already logged in to ", Object.values(ctxs));
}
}
run();
