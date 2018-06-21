const cheerio = require('cheerio')
const URI = require('urijs')

const { request } = require('../utils')
const Resolver = require('./resolver')

const ERRORS = require('../errors')

async function getTrackInfo (url) {
  const { body } = await request(url)
  const trackInfo = /trackinfo: (.+),\s*?\n/gi.exec(body)[1]
  return { trackInfo, body }
}

class BandcampResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Bandcamp'
    this._valid_url = /^https?:\/\/.*?\.bandcamp\.com\/track\/([^\/?#&]+)/i
  }

  async extract (url) {
    const { trackInfo, body } = await getTrackInfo(url)

    // TODO: handle pages with free download page link

    if (!trackInfo) {
      throw Object.assign(new Error('Not Streamable', {
        code: ERRORS.ERR_NOT_STREAMABLE,
        url: url
      }))
    }

    const $ = cheerio.load(body)
    const thumbnail = $('meta[property="og:image"]').attr('content')

    const tracks = JSON.parse(trackInfo)

    // TODO: grab formats and sort
    const file = tracks[0].file
    const file_url = new URI(file[Object.keys(file)[0]]).absoluteTo('http://').toString()

    return super.extract({
      id: tracks[0].id,
      extractor: this._name,
      fulltitle: tracks[0].title,
      url: file_url,
      duration: tracks[0].duration,
      thumbnail: thumbnail
    })
  }
}

class BandcampAlbumResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Bandcamp:album'
    this._valid_url = /^https?:\/\/(?:([^.]+)\.)?bandcamp\.com(?:\/album\/([^\/?#&]+))?/i
  }

  async extract (url) {
    const { trackInfo, body } = await getTrackInfo(url)

    // TODO: handle pages with free download page link

    if (!trackInfo) {
      throw Object.assign(new Error('Not Streamable', {
        code: ERRORS.ERR_NOT_STREAMABLE,
        url: url
      }))
    }

    const $ = cheerio.load(body)
    const thumbnail = $('meta[property="og:image"]').attr('content')

    const tracks = JSON.parse(trackInfo)
    let entries = []

    tracks.forEach((track) => {
      const file = track.file
      const file_url = new URI(file[Object.keys(file)[0]]).absoluteTo('http://').toString()

      entries.push(super.extract({
          id: tracks[0].id,
          extractor: this._name,
          fulltitle: tracks[0].title,
          url: file_url,
          duration: tracks[0].duration,
          thumbnail: thumbnail
      }))
    })

    return entries
  }
}

class BandcampWeeklyResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Bandcamp:weekly'
    this._valid_url = /^https?:\/\/(?:www\.)?bandcamp\.com\/?\?(?:.*?&)?show=(\d+)/i
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

module.exports.default = [
  BandcampResolver,
  BandcampAlbumResolver,
  BandcampWeeklyResolver
]
