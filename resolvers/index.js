const fs = require('fs')

let resolvers = []
fs.readdirSync(__dirname).forEach((file) => {
  if (file === 'index.js' || file === 'resolver.js') {
    return
  }

  const Resolvers = require(`./${file}`).default
  Resolvers.forEach((Resolver) => {
    const resolver = new Resolver()
    resolvers.push(resolver)
  })
})

module.exports = resolvers
