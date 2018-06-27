const { request } = require('../utils')
const Resolver = require('./resolver')

const ERRORS = require('../errors')

function xorStrings(key,input){
  let output = ''
  for (let i=0; i<input.length; i++) {
    var c = input.charCodeAt(i)
    var k = key.charCodeAt(i % key.length)
    output += String.fromCharCode(c ^ k)
  }

  return output
}

const getNestedObject = (nestedObj, pathArr) => {
  return pathArr.reduce((obj, key) =>
    (obj && obj[key] !== 'undefined') ? obj[key] : undefined, nestedObj);
}

class MixcloudResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Mixcloud'
    this._valid_url = /^https?:\/\/(?:(?:www|beta|m)\.)?mixcloud\.com\/([^\/]+)\/(?!stream|uploads|favorites|listens|playlists)([^\/]+)/ig
  }

  async extract (url) {
    const re_result = this._valid_url.exec(url)

    const response = await request(url)
    let encrypted_play_info = /m-play-info="([^"]+)"/.exec(response.body)

    let info_json

    if (encrypted_play_info) {
      encrypted_play_info = new Buffer(encrypted_play_info, 'base64').toString('ascii')
    } else {
      const json_re = /<script id="relay-data" type="text\/x-mixcloud">([^<]+)<\/script>/i
      const json_re_result = json_re.exec(response.body)
      let full_info_json = JSON.parse(json_re_result[1].replace(/&quot;/g, '"'))


      full_info_json.forEach((item) => {
        const item_data = getNestedObject(item, ['cloudcast', 'data', 'cloudcastLookup'])
        if (getNestedObject(item_data, ['streamInfo', 'url'])) {
          info_json = item_data
        }
      })
    }

    const js_url_re = /<script[^>]+\bsrc=["\"](https:\/\/(?:www\.)?mixcloud\.com\/media\/(?:js2\/www_js_4|js\/www)\.[^>]+\.js)/i
    const js_url = js_url_re.exec(response.body)[1]
    const js_response = await request(js_url)

    let kps, kpa_target, key

    if (encrypted_play_info) {
      kps = ['{"stream_url":']
      kpa_target = encrypted_play_info
    } else {
      kps = ['https://', 'http://']
      kpa_target = new Buffer(info_json.streamInfo.url, 'base64').toString('ascii')
    }

    kps.forEach((kp) => {
      const partial_key = xorStrings(kpa_target, kp)
      const escaped_partial_key = partial_key.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')

      const quotes = ["'",'"']
      quotes.forEach((quote) => {
        const key_re = new RegExp(`${quote}(${escaped_partial_key}[^${quote}]*)${quote}`)
        const re_result = key_re.exec(js_response.body)
        if (re_result) {
          key = re_result[1]
        }
      })
    })

    if (encrypted_play_info) {
      const play_info = JSON.parse(xorStrings(key, encrypted_play_info))

      if (!play_info.stream_url) {
        throw Object.assign(new Error('Not Streamable', {
          code: ERRORS.ERR_NOT_STREAMABLE,
          url: url
        }))
      }

      const uploader_id_re = /\s+"profile": "([^"]+)",/i
      const title_re = /m-title="([^"]+)"/i
      const thumbnail_re = /m-thumbnail-url="([^"]+)"/i

      return super.extract({
        extractor: this._name,
        url: play_info.stream_url,
        webpage_url: url
      })

    } else {

      const format_url = info_json.streamInfo['url']
      const format_url_decoded = new Buffer(format_url, 'base64').toString('ascii')
      const decrypted_url = xorStrings(key, format_url_decoded)

      const picture_root = getNestedObject(info_json, ['picture', 'urlRoot'])
      const thumbnail = `https://thumbnailer.mixcloud.com/unsafe/600x600/${picture_root}`

      return super.extract({
        id: `${info_json.owner.username}-${info_json.slug}`,
        extractor: this._name,
        thumbnail: thumbnail,
        fulltitle: info_json.name,
        webpage_url: `https://www.mixcloud.com/${info_json.owner.username}/${info_json.slug}`,
        url: decrypted_url
      })

      /* const url_keys = ['url', 'hlsUrl', 'dashUrl']
       * url_keys.forEach((url_key) => {
       *   const format_url = info_json.streamInfo[url_key]
       *   console.log(format_url)

       *   const format_url_decoded = new Buffer(format_url, 'base64').toString('ascii')
       *   const decrypted = xorStrings(key, format_url_decoded)
       *   console.log(decrypted)
       * })
       */
    }
  }
}

class MixcloudPlaylistResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Mixcloud:playlist'
    this._valid_url = /^https?:\/\/(?:www\.)?mixcloud\.com\/([^\/]+)\/playlists\/([^\/]+)\/?$/ig
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

class MixcloudUserResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Mixcloud:user'
    this._valid_url = /^https?:\/\/(?:www\.)?mixcloud\.com\/([^\/]+)\/(uploads|favorites|listens)?\/?$/ig
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

module.exports.default = [
  MixcloudResolver,
  MixcloudPlaylistResolver,
  MixcloudUserResolver
]
