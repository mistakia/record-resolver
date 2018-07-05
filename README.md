# Record Resolver

[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat)](https://github.com/RichardLitt/standard-readme)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmistakia%2Frecord-resolver.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmistakia%2Frecord-resolver?ref=badge_shield)

> Resolver for Record.

## Install
```
npm install
```

## Usage
### CLI
```
wip
```

### Module
```js
const resolver = require('resolver')
const url = 'http://www.youtube.com/watch?v=iODdvJGpfIA'

resolver(url, (err, info) => {
  if (err) {
     console.log(err)
     return
  }

  console.log(info)
})
```
or use with await inside an async function
```js
const resolver = require('resolver')

try {
  const url = 'http://www.youtube.com/watch?v=iODdvJGpfIA'
  const info = await resolver(url)
} catch (e) {
  console.log(e)
}
```

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmistakia%2Frecord-resolver.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmistakia%2Frecord-resolver?ref=badge_large)