const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Mixcloud Tests', () => {

  const mixcloud_url = 'https://www.mixcloud.com/johndigweed/transitions-with-john-digweed-and-chymera/'
  describe(`Mixcloud Mix Test: ${mixcloud_url}`, () => {
    let result

    before((done) => {
      resolver(mixcloud_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a single mixcloud mix', () => {
      result.should.have.length(1)
    })

    it('identify mixcloud id', () => {
      result[0].id.should.equal('johndigweed-transitions-with-john-digweed-and-chymera')
    })

    it('identify extractor as Mixcloud', () => {
      result[0].extractor.should.equal('Mixcloud')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://thumbnailer.mixcloud.com/unsafe/600x600/extaudio/8/7/5/b/76c0-c2b0-4dbb-86a8-7b3fa43c77b4.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('Transitions with John Digweed and Chymera')
    })

    /* it('identify duration', () => {
     *   result[0]._duration_raw.should.equal(6938)
     * })
     */
  })

})
