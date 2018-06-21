#!/usr/bin/env node

const argv = require('yargs').argv
const resolver = require('../')

const run = async (url) => {
  try {
    const result = await resolver(url)
    console.log(result)
  } catch (e) {
    console.log(e)
  }
}

const url = argv.u || argv.url || process.argv[2]
run(url)
