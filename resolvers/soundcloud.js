const URI = require('urijs')

const { request } = require('../utils')
const ERRORS = require('../errors')
const Resolver = require('./resolver')

let _CLIENT_ID

const _resolveUrl = (url) => {
  return `https://api.soundcloud.com/resolve.json?url=${url}&client_id=${_CLIENT_ID}`
}

const _streamUrl = (url, token) => {
  return new URI(url).query((data) => {
    data.client_id = _CLIENT_ID

    if (token) {
      data.secret_token = token
    }
  }).toString()
}

const _getClientId = async () => {
  const { body } = await request({
    url: 'https://soundcloud.com/',
    maxAttempts: 2
  })

  const appjs_re = /\ssrc="(https:\/\/a-v2.sndcdn.com\/assets\/app-[A-Za-z0-9-]*.js)"><\/script>/
  const appjs_url = body.match(appjs_re)[1]
  const appjs_response = await request({ url: appjs_url, maxAttempts: 2 })

  const client_id_re = /client_id:"([0-9A-Za-z]{32})"/
  const CLIENT_ID = appjs_response.body.match(client_id_re)[1]

  return CLIENT_ID
}


class SoundcloudResolver extends Resolver {
  constructor () {
    super()
    this._CLIENT_ID
    this._name = 'Soundcloud'
    this._valid_url = new RegExp(
      '^(?:https?:\/\/)?' +
      '(?:(?:(?:www\\.|m\\.)?soundcloud\\.com\/' +
      '(?!stations\/track)' +
      '([\\w\\d-]+)\/' +
      '(?!(?:tracks|sets(?:\/.+?)?|reposts|likes|spotlight)\/?(?:$|[?#]))' +
      '([\\w\\d-]+)\/?' +
      '([^?]+?)?(?:[?].*)?$)' +
      '|(?:api\\.soundcloud\.com\/tracks\/(\\d+)' +
      '(?:\/?\\?secret_token=([^&]+))?)' +
      '|((?:w|player|p.)\\.soundcloud\\.com\/player\/?.*?url=.*))', 'i')
  }

  async extract (url) {
    if (!_CLIENT_ID) {
      _CLIENT_ID = await _getClientId()
    }

    const re_result = this._valid_url.exec(url)
    const track_id = re_result[4]
    let info_json_url, token

    if (track_id) {
      info_json_url = `https://api.soundcloud.com/tracks/${track_id}.json?client_id=${_CLIENT_ID}`
      token = re_result[5]
      if (token) {
        info_json_url += `&secret_token=${token}`
      }
    } else if (re_result[6]) {
      const query = new URI(url).query(true)

      const real_url = query.url

      if (query['secret_token']) {
        real_url += `?secret_token=${query['secret_token']}`
      }

      if (this.suitable(real_url)) {
        info_json_url = _streamUrl(real_url)
      } else {

        const spR = new SoundcloudPlaylistResolver()
        if (spR.suitable(real_url)) {
          return spR.extract(real_url)
        }

        const ssR = new SoundcloudSetResolver()
        if (ssR.suitable(real_url)) {
          return ssR.extract(real_url)
        }

        throw Object.assign(new Error('not a suitable url'), {
          code: ERRORS.ERR_NOT_SUITABLE_URL,
          url: real_url
        })
      }
    } else {
      const uploader = re_result[1]
      const slug_title = re_result[2]
      token = re_result[3]

      let resolve_title = `${uploader}/${slug_title}`
      if (token) {
        resolve_title += `/${token}`
      }

      const url = `https://soundcloud.com/${resolve_title}`
      info_json_url = _resolveUrl(url)
    }

    const { body } = await request({
      url: info_json_url,
      json: true
    })

    // TODO: handle CLIENT_ID related 401s & 403s

    /* let qs = {
     *   client_id: _CLIENT_ID
     * }

     * if (token) {
     *   qs['secret_token'] = token
     * }

     * const stream_response = await request({
     *   url: `https://api.soundcloud.com/i1/tracks/${body.id}/streams`,
     *   qs: qs,
     *   json: true
     * }) */

    const thumbnail = body.artwork_url ? body.artwork_url.replace('-large', '-t500x500') : null

    return super.extract({
      id: body.id,
      thumbnail: thumbnail,
      url: body.stream_url ? _streamUrl(body.stream_url, token) : null,
      duration: parseInt(body.duration / 1000, 10),
      fulltitle: body.title,
      extractor: this._name
    })
  }
}

class SoundcloudSetResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Soundcloud:set'
    this._valid_url = /https?:\/\/(?:(?:www|m)\.)?soundcloud\.com\/([\w\d-]+)\/sets\/([\w\d-]+)(?:\/([^?\/]+))?/i
  }

  async extract (url) {
    if (!_CLIENT_ID) {
      _CLIENT_ID = await _getClientId()
    }

    const re_result = this._valid_url.exec(url)
    const uploader = re_result[1]
    const slug_title = re_result[2]
    let full_title = `${uploader}/sets/${slug_title}`
    let s_url = `https://soundcloud.com/${uploader}/sets/${slug_title}`

    const token = re_result[3]
    if (token) {
      full_title += '/' + token
      s_url += '/' + token
    }

    const resolve_url = _resolveUrl(s_url)
    const { body } = await request({ url: resolve_url, json: true })

    let entries = []

    body.tracks.forEach((track) => {
      const thumbnail = track.artwork_url ?
                        track.artwork_url.replace('-large', '-t500x500') : null

      entries.push({
        id: track.id,
        thumbnail: thumbnail,
        duration: parseInt(track.duration / 1000, 10),
        fulltitle: track.title,
        extractor: this._name,
        url: _streamUrl(track.stream_url)
      })
    })

    return entries
  }
}

class SoundcloudUserResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Soundcloud:user'
    this._valid_url = /https?:\/\/(?:(?:www|m)\.)?soundcloud\.com\/([^\/]+)(?:\/(tracks|sets|reposts|likes|spotlight))?\/?(?:[?#].*)?$/i
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

class SoundcloudPlaylistResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Soundcloud:playlist'
    this._valid_url = /https?:\/\/api\.soundcloud\.com\/playlists\/([0-9]+)(?:\/?\?secret_token=([^&]+?))?$/i
  }

  async extract (url) {
    if (!_CLIENT_ID) {
      _CLIENT_ID = await _getClientId()
    }

    const re_result = this._valid_url.exec(url)
    const playlist_id = re_result[1]
    let base_url = `https://api.soundcloud.com/playlists/${playlist_id}.json?`
    const token = re_result[2]
    if (token) {
      base_url += `secret_token=${token}`
    }

    base_url = _streamUrl(base_url)

    const { body } = await request({ url: base_url, json: true })

    let entries = []

    body.tracks.forEach((track) => {
      const thumbnail = track.artwork_url ?
                        track.artwork_url.replace('-large', '-t500x500') : null

      entries.push({
        id: track.id,
        thumbnail: thumbnail,
        duration: parseInt(track.duration / 1000, 10),
        fulltitle: track.title,
        extractor: this._name,
        url: _streamUrl(track.stream_url)
      })
    })

    return entries
  }
}

class SoundcloudTrackStationResolver extends Resolver {
  constructor () {
    super()

    this._name = 'Soundcloud:trackstation'
    this._valid_url = /https?:\/\/(?:(?:www|m)\.)?soundcloud\.com\/stations\/track\/[^\/]+\/([^\/?#&]+)/i
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

module.exports.SoundcloudResolver = SoundcloudResolver

module.exports.default = [
  SoundcloudResolver,
  SoundcloudSetResolver,
  SoundcloudUserResolver,
  SoundcloudTrackStationResolver,
  SoundcloudPlaylistResolver
]
