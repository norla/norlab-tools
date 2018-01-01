#!/usr/bin/env node

const { AutoComplete } = require("enquirer");
const spawn = require("child_process").spawn;
const k8s = require("kubernetes-client");

async function run() {
  const defaultConf = new k8s.KubeConfig();
  defaultConf.loadFromDefault();
  const prompt = new AutoComplete({
    message: "Cluster",
    choices: defaultConf.clusters.map(({ name }) => name),
  });
  const cluster = await prompt.run();

  defaultConf.setCurrentContext(club);

  console.log("- - - DEBUG defaultConf", JSON.stringify(defaultConf, null, 2));
}

run()
