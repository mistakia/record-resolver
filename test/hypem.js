const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Hypem Tests', () => {

  const hypem_url = 'https://hypem.com/track/hm5b/Busy+P+-+To+Protect+And+Entertain+(Crookers+Remix)'
  describe(`Hypem Track Test: ${hypem_url}`, () => {
    let result

    before((done) => {
      resolver(hypem_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a single hypem track', () => {
      result.should.have.length(1)
    })

    it('identify hypem id', () => {
      result[0].id.should.equal('hm5b')
    })

    it('identify extractor as hypem', () => {
      result[0].extractor.should.equal('Hypem')
    })

    it('identify stream url', () => {
      result[0].url.should.equal('http://livingears.com/music/LivingEarsRadio/042410/To Protect And Entertain Crookers.mp3')
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://static.hypem.com/items_images/ab/hm5b_500.jpg')
    })


    it('identify title', () => {
      result[0].fulltitle.should.equal('To Protect And Entertain (Crookers Remix...')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('https://hypem.com/track/hm5b/Busy+P+-+To+Protect+And+Entertain+(Crookers+Remix)')
    })

    /* it('identify duration', () => {
     *   result[0]._duration_raw.should.equal(389)
     * })
     */
  })

})
