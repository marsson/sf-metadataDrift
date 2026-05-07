#!/usr/bin/env node

const { run, flush } = require('@oclif/core');
const { handle } = require('@oclif/core/lib/errors');
const path = require('path');

run(process.argv.slice(2), path.join(__dirname, '..'))
  .then(flush)
  .catch(handle);
