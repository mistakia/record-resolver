const { request } = require('../utils')
const Resolver = require('./resolver')

const { SoundcloudResolver } = require('./soundcloud')

class AudiomackResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Audiomack'
    this._valid_url = /^https?:\/\/(?:www\.)?audiomack\.com\/song\/([\w\/-]+)/i
  }

  async extract (url) {
    const re_result = this._valid_url.exec(url)
    const id = re_result[1]
    const audiomack_url = `http://www.audiomack.com/api/music/url/song/${id}?extended=1&_=${new Date().getTime()}`
    const { body } = await request({ url: audiomack_url, json: true })

    const sr = new SoundcloudResolver()
    if (sr.suitable(body.url)) {
      return await sr.extract(url)
    }

    return super.extract({
      id: body.id,
      extractor: this._name,
      url: body.url,
      webpage_url: url,
      fulltitle: body.title,
      duration: body.duration
    })
  }
}

class AudiomackEmbedResolver extends AudiomackResolver {
  constructor() {
    super()
    this._valid_url = /https?:\/\/(?:www\.)?audiomack\.com\/embed4(?:\-thin|\-large)?\/([\w\/-]+)/i
  }
}

class AudiomackAlbumResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Audiomack:album'
    this._valid_url = /^https?:\/\/(?:www\.)?audiomack\.com\/album\/([\w\/-]+)/i
  }

  async extract (url) {
    let count = 0
    let entries = []
    let tracks_remaining = true

    const re_result = this._valid_url.exec(url)
    const id = re_result[1]

    while (tracks_remaining) {
      const audiomack_url = `http://www.audiomack.com/api/music/url/album/${id}/${count}/?extended=1&_=${new Date().getTime()}`
      const response = await request({ url: audiomack_url, json: true })

      const { body } = response

      if (!body.id) {
        tracks_remaining = false
        continue
      }

      const sr = new SoundcloudResolver()

      if (!body.url) {
        count++
        continue
      }

      let item
      if (sr.suitable(body.url)) {
        item = await sr.extract(url)
      } else {
        const permalink_re = /^https?:\/\/(?:music\.)?audiomack\.com\/albums\/([\w-]+)\/(?:[\w-]+)\/([\w\/-]+)/ig
        const permalink_re_result = permalink_re.exec(body.url)
        const artist = permalink_re_result[1]
        const song_title = permalink_re_result[2]
        const permalink = `https://audiomack.com/song/${artist}/${song_title}`

        item = {
          id: body.id,
          extractor: this._name,
          url: body.url,
          fulltitle: body.title,
          webpage_url: permalink,
          duration: body.duration
        }
        entries.push(item)
      }

      count++
    }

    // TODO: extend with defaults
    return entries
  }
}

class AudiomackAlbumEmbedResolver extends AudiomackAlbumResolver {
  constructor () {
    super()
    this._valid_url = /https?:\/\/(?:www\.)?audiomack\.com\/embed4-album\/([\w\/-]+)/i
  }
}

module.exports.default = [
  AudiomackResolver,
  AudiomackEmbedResolver,
  AudiomackAlbumResolver,
  AudiomackAlbumEmbedResolver
]
