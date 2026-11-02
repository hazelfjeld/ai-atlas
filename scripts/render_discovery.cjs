'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
const data={};
for(const kind of ['terms','technologies','papers','alerts','playbooks']){
  const files=['papers','alerts'].includes(kind)?manifest.files.filter(f=>f.kind===kind):manifest.extensions[kind];
  data[kind]=files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(root,f.path))));
}
process.stdout.write(require('../discovery.js').render(data));
