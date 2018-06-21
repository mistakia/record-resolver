const ytdl = require('ytdl-core')

const Resolver = require('./resolver')

const playlist_re = '(?:PL|LL|EC|UU|FL|RD|UL|TL)[0-9A-Za-z-_]{10,}'
const SUPPORTED_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/MPA',
    'audio/mpa-robust',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
    'audio/MP4A-LATM',
    'audio/mpeg4-generic',
    'audio/ogg',
    'audio/wav',
    'audio/wave',
    'audio/x-wav'
]

// sorted from worst to best
const YTDL_AUDIO_ENCODINGS = [
    'mp3',
    'aac',
    'vorbis',
    'wav'
]

class YoutubeResolver extends Resolver {
  constructor () {
    super()
    this._name = 'Youtube'

    this._valid_url = new RegExp(
      '(' +
      '(?:https?:\/\/|\/\/)' +
      '(?:(?:(?:(?:\w+\.)?[yY][oO][uU][tT][uU][bB][eE](?:-nocookie)?\\.com\/|' +
      '(?:www\\.)?deturl\\.com\/www\\.youtube\\.com\/|' +
      '(?:www\\.)?pwnyoutube\\.com\/|' +
      '(?:www\\.)?hooktube\\.com\/|' +
      '(?:www\\.)?yourepeat\\.com\/|' +
      'tube\\.majestyc\\.net\/|' +
      'youtube\\.googleapis\\.com\/)' +
      '(?:.*?\\#\/)?' +
      '(?:' +
      '(?:(?:v|embed|e)\/(?!videoseries))' +
      '|(?:' +
      '(?:(?:watch|movie)(?:_popup)?(?:\\.php)?\/?)?' +
      '(?:\\?|\\#!?)' +
      '(?:.*?[&;])??' +
      'v=' +
      ')' +
      '))' +
      '|(?:' +
      'youtu\\.be|' +
      'vid\\.plus|' +
      'zwearz\\.com\/watch|' +
      ')\/' +
      '|(?:www\\.)?cleanvideosearch\\.com\/media\/action\/yt\/watch\\?videoId=' +
      ')' +
      ')?' +
      '([0-9A-Za-z_-]{11})' +
      '(?!.*?\\blist=' +
      '(?:' +
      `%(${playlist_re})s|` +
      'WL' +
      ')' +
      ')', 'i')
    //'(?(1).+)?', 'i')
  }

  async extract (url) {
    const re_result = this._valid_url.exec(url)
    const video_id = re_result[2]

    const info = await ytdl.getInfo(video_id)
    let bestFormat

    const formats = info.formats.filter((f) => {
      if (!f.type) return false

      const idx = f.type.indexOf(';')
      const type = idx > -1 ? f.type.substr(0, idx) : f.type
      return SUPPORTED_TYPES.indexOf(type) > -1
    })

    for (let i = 0; i < formats.length; i += 1) {
      let format = formats[i]

      if (bestFormat == null || format.audioBitrate > bestFormat.audioBitrate || (format.audioBitrate === bestFormat.audioBitrate && YTDL_AUDIO_ENCODINGS.indexOf(format.audioEncoding) > YTDL_AUDIO_ENCODINGS.indexOf(bestFormat.audioEncoding))) {
	bestFormat = format;
      }
    }

    return super.extract({
      id: info.video_id,
      extractor: this._name,
      fulltitle: info.title,
      url: bestFormat ? bestFormat.url : null,
      duration: parseInt(info.length_seconds, 10),
      thumbnail: info.thumbnail_url
    })
  }
}

module.exports.default = [
  YoutubeResolver
]
