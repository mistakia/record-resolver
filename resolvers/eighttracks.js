const async = require('async')

const { request } = require('../utils')
const Resolver = require('./resolver')

class EighttracksResolver extends Resolver {
  constructor () {
    super()
    this._name = '8tracks'
    this._valid_url = /^https?:\/\/8tracks\.com\/([^\/]+)\/([^\/#]+)(?:#.*)?$/i
  }

  async extract (url) {
    const response = await request(url)
    const mix = JSON.parse(/PAGE.mix = (.*?);\n/gi.exec(response.body)[1])
    const session = Math.floor(Math.random() * (1000000000 - 0 + 1) + 0).toString()
    let next_url = `http://8tracks.com/sets/${session}/play?player=sm&format=jsonh&mix_id=${mix.id}`

    let avg_song_duration = parseInt(mix.duration, 10) / mix.tracks_count

    if (avg_song_duration <= 0) {
      avg_song_duration = 300
    }

    let tracks = []

    for (let i=0; i < mix.tracks_count; i++) {
      //TODO: retry a couple times on error and sleep based on avg_song_duration
      const { body } = await request({ url: next_url, json: true })

      const track_data = body.set.track
      next_url = `http://8tracks.com/sets/${session}/next?player=sm&format=jsonh&mix_id=${mix.id}&track_id=${track_data.id}`
      const track = super.extract({
        id: track_data.id,
        extractor: this._name,
        url: track_data.track_file_stream_url,
        fulltitle: `${track_data.performer} - ${track_data.name}`
      })
      tracks.push(track)
    }

    return tracks
  }
}

module.exports.default = [EighttracksResolver]
