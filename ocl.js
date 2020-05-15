"use strict";

const { AutoComplete } = require("enquirer");
const { Client } = require("kubernetes-client");
const spawn = require("child_process").spawn;
const client = new Client({ version: "1.13" });

function uniq(list) {
  return list.reduce((acc, d) => (acc.includes(d) ? acc : acc.concat(d)), []);
}

async function run() {
  const namespaces = await client.api.v1.namespaces.get();

  const prompt = new AutoComplete({
    name: "Namespace",
    message: "namespace",
    limit: 10,
    initial: 2,
    choices: namespaces.body.items.map(({ metadata }) => metadata.name),
  });

  const namespace = await prompt.run();
  const pods = await client.api.v1.namespaces(namespace).pods.get();
  const appLabels = pods.body.items
    .map((item) => item.metadata.labels.app)
    .filter((l) => l);

  const prompt2 = new AutoComplete({
    name: "Namespace",
    message: "label",
    choices: uniq(appLabels),
  });
  const appLabel = await prompt2.run();

  spawn("stern", ["-n", namespace, "-l", `app=${appLabel}`], {
    stdio: "inherit",
    detached: false,
  });
}
run();
