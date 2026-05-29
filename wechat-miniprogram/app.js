App({
  onLaunch: function () {
    // Initialize storage and audio options if needed
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        speakerOn: true,
        success: () => console.log('Global setInnerAudioOption success'),
        fail: (err) => console.error('Global setInnerAudioOption fail', err)
      });
    }
  }
});
