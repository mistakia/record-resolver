const fs = require('fs')

let Resolvers = []
let resolvers = []

const audiomackResolvers = require('./audiomack').default
Resolvers = Resolvers.concat(audiomackResolvers)
const bandcampResolvers = require('./bandcamp').default
Resolvers = Resolvers.concat(bandcampResolvers)
const eighttracksResolvers = require('./eighttracks').default
Resolvers = Resolvers.concat(eighttracksResolvers)
const hypemResolvers = require('./hypem').default
Resolvers = Resolvers.concat(hypemResolvers)
const mixcloudResolvers = require('./mixcloud').default
Resolvers = Resolvers.concat(mixcloudResolvers)
const soundcloudResolvers = require('./soundcloud').default
Resolvers = Resolvers.concat(soundcloudResolvers)
const youtubeResolvers = require('./youtube').default
Resolvers = Resolvers.concat(youtubeResolvers)
const vimeoResolvers = require('./vimeo').default
Resolvers = Resolvers.concat(vimeoResolvers)

Resolvers.forEach((Resolver) => {
  const resolver = new Resolver()
  resolvers.push(resolver)
})

module.exports = resolvers
