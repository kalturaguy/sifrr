describe('sifrr-seo', () => {
  describe('no js', () => {
    before(async () => {
      await page.setJavaScriptEnabled(false);
      await page.setUserAgent('Opera Mini');
      await page.goto(`${PATH}/`);
    });

    it('doesn\'t have sifrr when js disabled', async () => {
      const sifrr = await page.evaluate(() => typeof Sifrr);

      assert.equal(sifrr, 'undefined');
    });

    it('renders sifrr-test on server (with sr)', async () => {
      const html = await page.$eval('sifrr-test', el => el.innerHTML.trim());

      expect(html).to.have.string('<p>Simple element</p>');
      expect(html).to.have.string('<p>1</p>');
    });

    it('renders sifrr-test on server (without sr)', async () => {
      const html = await page.$eval('sifrr-nosr', el => el.innerHTML.trim());

      expect(html).to.have.string('<p>No shadow root</p>');
      expect(html).to.have.string('<p>2</p>');
    });
  });

  describe('with js', () => {
    before(async () => {
      await page.setJavaScriptEnabled(true);
      await page.setUserAgent('Opera Mini');
      await page.goto(`${PATH}/`);
    });

    it('renders sifrr-test again locally (with sr)', async () => {
      const html1 = await page.$eval('sifrr-test', el => el.innerHTML.trim());
      const html2 = await page.$eval('sifrr-test', async el => {
        await customElements.whenDefined('sifrr-test');
        return el.shadowRoot.innerHTML;
      });

      expect(html1).to.have.string('<p>Simple element</p>');
      expect(html2).to.have.string('<p>Simple element</p>');
      expect(html1).to.have.string('<p>1</p>');
      expect(html2).to.have.string('<p>1</p>');
    });

    it('renders sifrr-test again locally (without sr)', async () => {
      const html = await page.$eval('sifrr-nosr', async el => {
        await customElements.whenDefined('sifrr-nosr');
        return el.innerHTML;
      });

      expect(html).to.have.string('<p>No shadow root</p>');
      expect(html).to.have.string('<p>2</p>');
    });
  });
});