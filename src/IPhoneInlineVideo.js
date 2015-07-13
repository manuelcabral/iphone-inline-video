'use strict';

var eventEmitter = require('minimal-event-emitter');

function defaultVideoSrcToAudioSrc(videoSrc) {
  var extensionRegex = /\.[a-zA-Z0-9]+$/;
  return videoSrc.replace(extensionRegex, '.mp3');
}

function IPhoneInlineVideo(videoSrcToAudioSrc) {
  if(typeof(videoSrcToAudioSrc) === 'string') {
    this._videoSrcToAudioSrc = function() { return videoSrcToAudioSrc; };
  }
  else if(typeof(videoSrcToAudioSrc) === 'function') {
    this._videoSrcToAudioSrc = videoSrcToAudioSrc;
  }
  else if(videoSrcToAudioSrc === undefined) {
    this._videoSrcToAudioSrc = defaultVideoSrcToAudioSrc;    
  }
  else {
    throw new Error("Invalid value for argument 0 (videoSrcToAudioSrc):", videoSrcToAudioSrc);
  }

  this._videoElement = document.createElement('video');
  this._videoElement.volume = 0;


  this._audioElement = document.createElement('audio');

  this._fakePlayAnimationFrameRequest = null;
  this._fakePlayingEmitted = false;

  var self = this;
  self.addEventListener('error', function() {
    if(self.onerror) { self.onerror(); }
  });
  self.addEventListener('playing', function() {
    if(self.onplaying) { self.onplaying(); }
  });

  self._videoElement.addEventListener('loadedmetadata', function() {
    self.emit('loadedmetadata');
  });
  self.addEventListener('loadedmetadata', function() {
    if(self.onloadedmetadata) { self.onloadedmetadata(); }
  });

  self.__defineGetter__("currentTime", function() {
    return self._videoElement.currentTime;
  });

  self.__defineSetter__("currentTime", function(val) {
    self._videoElement.currentTime = val;
    self._audioElement.currentTime = val;
  });

  self.__defineGetter__("src", function() { return self._videoElement.src; });
  self.__defineSetter__("src", function(val) {
    self._videoElement.src = val;

    // Required for frame to appear when setting currentTime
    self._videoElement.load();

    var audioUrl = self._videoSrcToAudioSrc(val);
    self._audioElement.src = audioUrl;
  });


  self.__defineGetter__("volume", function() {
    return self._audioElement.volume;
  });
  
  self.__defineSetter__("volume", function(val) {
    var changed = self._audioElement.volume !== val;
    self._audioElement.volume = val;
    if(changed) {
      self.emit('volumechange');
    }
  });

  self.__defineGetter__("duration", function() { return self._videoElement.duration; });

  self.__defineGetter__("paused", function() { return this._fakePlayAnimationFrameRequest === null; });
}

eventEmitter(IPhoneInlineVideo);

IPhoneInlineVideo.prototype.videoElement = function() {
  return this._videoElement;
};

IPhoneInlineVideo.prototype.removeAttribute = function() {
  return this._videoElement.removeAttribute.apply(this._videoElement, arguments);
};
IPhoneInlineVideo.prototype.setAttribute = function() {
  return this._videoElement.setAttribute.apply(this._videoElement, arguments);
};

IPhoneInlineVideo.prototype.audioElement = function() {
  return this._audioElement;
};

IPhoneInlineVideo.prototype.play = function() {
  var self = this;

  if(self._fakePlayAnimationFrameRequest) { return; } // Already playing

  self._audioElement.currentTime = self._videoElement.currentTime;

  self._fakePlayingEmitted = false;

  var lastTime = Date.now();

  function fakePlayLoop() {
    // Schedule the next play immediately, as self._fakePlayAnimationFrameRequest
    // is used by the "paused" getter
    self._fakePlayAnimationFrameRequest = requestAnimationFrame(fakePlayLoop);

    var time = Date.now();

    if(self._videoElement.readyState >= self._videoElement.HAVE_METADATA &&
       self._audioElement.readyState >= self._audioElement.HAVE_METADATA) {

      if(self._audioElement.paused) {
        self._audioElement.play();
      }

      var elapsed = (time - lastTime)/1000;

      self._videoElement.currentTime = self._videoElement.currentTime + elapsed;
      self.emit('timeupdate');

      if(!self._fakePlayingEmitted) {
        self.emit('play');
        self.emit('playing');
        self._fakePlayingEmitted = true;
      }
    }

    lastTime = time;
  }

  fakePlayLoop();

};


IPhoneInlineVideo.prototype.pause = function() {
  this._audioElement.pause();
  cancelAnimationFrame(this._fakePlayAnimationFrameRequest);
  this._fakePlayAnimationFrameRequest = null;

  this.emit('pause');
};



module.exports = IPhoneInlineVideo;