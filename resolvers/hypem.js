const { request } = require('../utils')
const Resolver = require('./resolver')

class HypemResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Hypem'
    this._valid_url = /^https?:\/\/(?:www\.)?hypem\.com\/track\/([^\/]+)/i
  }

  async extract (url) {

    url = url + '?' + encodeURIComponent({'ax': 1, 'ts': Date.now()})
    const { body } = await request(url)

    const html_tracks = /<script type="application\/json" id="displayList-data">\s*(.*?)\s*<\/script>/.exec(body)[1]

    const track = JSON.parse(html_tracks).tracks[0];
    const serve_url = `http://hypem.com/serve/source/${track.id}/${track.key}`
    const track_response = await request({ url: serve_url, json: true })
    const stream_url = track_response.body.url

    return super.extract({
      id: track.id,
      extractor: this._name,
      url: stream_url,
      fulltitle: track.song
    })
  }
}

module.exports.default = [HypemResolver]
