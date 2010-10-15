/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// frame/iframe create/starts loading
//   -current page unloads (about:blank for new elements)
//   -pagehide is triggered
//     -frame node added to _pendingFrames
//     -jsd on
//   -new page starts loading
//   -Jsd.topLevelHook.onCall triggered
//     -loop _pendingFrames
//       -onDocStart

// Most of this code can be removed as soon bug 342715 is fixed.


const DocStartScriptInjection = {

  init: function(pathSrc) {
    BootSource.init(pathSrc);
    PendingFrames.init();
  },

  shutdown: function() {
    BootSource.shutdown();
    PendingFrames.shutdown();
  },

  register: function(elem) {
    util.log("DocStartScriptInjection.register " + elem.tagName);
    switch (elem.tagName) {
      case "browser":
        elem.addProgressListener(this._browserElement, Ci.nsIWebProgress.NOTIFY_ALL);
        break;
      case "tabbrowser":
        elem.addTabsProgressListener(this._tabbrowserElement);
        break;
      default:
        throw elem.tagName;
    }
    elem.addEventListener("DOMContentLoaded", this._onDOMLoaded, false);
    elem.addEventListener("pagehide", this._onPageHide, false);
  },

  unregister: function(elem) {
    util.log("DocStartScriptInjection.unregister " + elem.tagName);
    switch (elem.tagName) {
      case "browser":
        elem.removeProgressListener(this._browserElement);
        break;
      case "tabbrowser":
        elem.removeTabsProgressListener(this._tabbrowserElement);
        break;
      default:
        throw elem.tagName;
    }
    elem.removeEventListener("DOMContentLoaded", this._onDOMLoaded, false);
    elem.removeEventListener("pagehide", this._onPageHide, false);
  },

  _tabbrowserElement: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
    onStateChange: function() {},
    onSecurityChange: function() {},
    onProgressChange: function() {},
    onStatusChange: function() {},
    onLinkIconAvailable: function() {},
    onLocationChange: function(aBrowser, aWebProgress, aRequest, aLocation) {
      // for frames: it fires only if DOMWindow is different from top window
      BootSource.onDocStart(aWebProgress.DOMWindow);
    }
  },

  _browserElement: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
    onStateChange: function() {},
    onSecurityChange: function() {},
    onProgressChange: function() {},
    onStatusChange: function() {},
    onLinkIconAvailable: function() {},
    onLocationChange: function(aWebProgress, aRequest, aLocation) {
      BootSource.onDocStart(aWebProgress.DOMWindow);
    }
  },

  _onPageHide: function(evt) {
    // new frames (about:blank) or new url
    var doc = evt.target;
    var frm = doc.defaultView.frameElement;
    if (frm !== null) { // top-level window?
      PendingFrames.addPendingFrame(frm);
    }
  },

  _onDOMLoaded: function(evt) {
    var doc = evt.target;
    var frm = doc.defaultView.frameElement;
    if (frm !== null) { // top-level window?
      PendingFrames.domLoaded(frm);
    }
  }

};


const BootSource = {
  init: function(pathSrc) {
    this._path = pathSrc;
    this._src = null;
    this._load(true);
  },

  shutdown: function() {
    delete this._path;
    delete this._src;
  },

  _load: function(async) {
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.onload = function() {
      BootSource._src = xhr.responseText;
      BootSource._path = null;
    };
    xhr.open("GET", this._path, async);
    xhr.overrideMimeType("text/plain");
    xhr.send(null);
  },

  onDocStart: function(win) {
    if (win._multifox_hooked) {
      win._multifox_hooked++;
      return;
    }

    if (this._src === null) {
      this._load(false);
    }

    var wrappedWin = new XPCNativeWrapper(win);
    var sandbox = new Components.utils.Sandbox(wrappedWin);
    sandbox.window = wrappedWin;
    //sandbox.document = wrappedWin.document;
    //sandbox.__proto__ = wrappedWin;

    try {
      // TODO http/s only
      Components.utils.evalInSandbox(this._src, sandbox);
      win._multifox_hooked = 1;
    } catch (ex) {
      switch (wrappedWin.document.documentURIObject.scheme) {
        case "http":
        case "https":
          Components.utils.import("${URI_JS_MODULE}/error.js");
          showError(wrappedWin, "sandbox");
          break;
      }
      util.log("[sandbox] " + win.document.location + "\n====8<-----\n" + ex);
    }

  }

};


const PendingFrames = {
  init: function() {
    this._pendingFrames = [];
    Jsd.disable();
  },

  shutdown: function() {
    Jsd.disable();
    delete this._pendingFrames;
  },

  addPendingFrame: function(frm) {
    if (this._pendingFrames.indexOf(frm) > -1) {
      util.log("pagehide event: frame already exists in _pendingFrames. " + frm.src + this._pendingFrames.indexOf(frm));
      return;
    }

    // when a document unloads, "pagehide" is triggered. This frame is useless. How to detect it?
    this._pendingFrames.push(frm);
    frm.contentWindow._multifox_pagehide = 1;
    ScheduleGc.start();
    Jsd.enable();

    // frm.tagName="object","iframe"
    //util.log("pagehide event: new frame added! " + frm.tagName  + " src=" + frm.src.substr(0, 80) + " doc=" + frm.contentDocument.location.href + " innerHTML=[" + frm.innerHTML + "]");
  },


  _removePendingFrame: function(idx) {
    this._pendingFrames.splice(idx, 1);
    if (this._pendingFrames.length === 0) {
      Jsd.disable(); // disable jsd asap
    }
  },

  tryToDispose: function() {
    for (var idx = this._pendingFrames.length - 1; idx > -1; idx--) {

      if (this._frameExists(this._pendingFrames[idx]) === false) {
        this._removePendingFrame(idx);
        continue;
      }

      var frameWin = this._pendingFrames[idx].contentWindow;

      if (!frameWin) {
        this._removePendingFrame(idx);
        util.log("tryToDispose frameWin empty "+frameWin);
        continue;
      }

      if (frameWin._multifox_pagehide) {
        util.log("tryToDispose frameWin._multifox_pagehide "+frameWin.document.location + frameWin._multifox_hooked + this._frameExists(this._pendingFrames[idx]));
        continue;
      }


      if (frameWin._multifox_hooked) {
        this._removePendingFrame(idx);
        util.log("tryToDispose _multifox_hooked="+frameWin);
      }
    }
    return this._pendingFrames.length > 0;
  },

  domLoaded: function(frm) {
    var idx = this._pendingFrames.indexOf(frm);
    if (idx > -1) {
      // frame without a <script>
      this._removePendingFrame(idx);
      BootSource.onDocStart(frm.contentWindow);
    }
  },

  onJavaScriptFound: function() {
    // we don't know which document Jsd.topLevelHook is referring to
    // we have to call BootSource.onDocStart for all pending frames
    var pending = this._pendingFrames;
    for (var idx = pending.length - 1; idx >= 0; idx--) {
      var frameWin = pending[idx] ? pending[idx].contentWindow : null;
      if (!frameWin) {
        // ???
        this._removePendingFrame(idx);
        util.log("onJavaScriptFound frameWin=" + frameWin + " pending[idx]=" + pending[idx] + " idx=" + idx);
        continue;
      }
      if (frameWin._multifox_pagehide) {
        // page not loaded yet
        continue;
      }

      this._removePendingFrame(idx);
      if (!frameWin._multifox_hooked) {
        BootSource.onDocStart(frameWin);
      }
    }
  },

  _frameExists: function(frm) {
    var winFrame = frm.contentWindow;

    if (!winFrame) { // null most of the time, sometimes it is undefined
      // win closed?
      util.log("frame does not exist! (win closed/frame removed?) src=" + frm.src);
      return false;
    }

    var myFrame = frm;
    var rootNotFound = true;
    do {
      var parentFrame = null;
      if (myFrame.ownerDocument.defaultView) {
        parentFrame = myFrame.ownerDocument.defaultView.frameElement;
      }

      if (parentFrame === null) {
        var parentFrame = new WindowProperties(winFrame).browser;
        if (parentFrame === null) {
          util.log("frame does not exist! (it does not have a parent)");
          return false;
        }
        rootNotFound = false;
      }
      var pos = parentFrame.contentDocument.documentElement.compareDocumentPosition(myFrame);
      if ((pos & 1) === 1) { // DOCUMENT_POSITION_DISCONNECTED=1
        util.log("frame does not exist! (frame removed?)");
        return false;
      }
      myFrame = parentFrame;
    } while (rootNotFound);

    return true;
  }

};


const ScheduleGc = {
  _timer: null,

  start: function() {
    if (this._timer === null) {
      this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this._timer.init(this, 200, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  observe: function(aSubject, aTopic, aData) {
    this._timer = null;
    if (PendingFrames.tryToDispose()) {
      this.start();
      util.log("ScheduleGc timer renewed");
    }
  }
};


const Jsd = {
  enable: function() {
    if (this._service !== null) {
      return;
    }
    //util.log("jsd ON");
    var i = Ci.jsdIDebuggerService;
    var service = Cc["@mozilla.org/js/jsd/debugger-service;1"].getService(i);
    service.topLevelHook = this;
    service.on();
    service.flags |= i.DISABLE_OBJECT_TRACE;
    this._service = service;
  },

  disable: function() {
    util.log("jsd OFF");
    if (this._service) {
      this._service.off();
    }
    this._service = null;
  },

  _service: null,

  QueryInterface: XPCOMUtils.generateQI([Ci.jsdICallHook]),
  onCall: function(frame, type) {
    if (type === Ci.jsdICallHook.TYPE_TOPLEVEL_START) {
      PendingFrames.onJavaScriptFound();
    }
  }

};
