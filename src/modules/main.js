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

const EXPORTED_SYMBOLS = ["NewWindow",
                          "Profile",     // error.js
                          "FindIdentity" // about:multifox
                         ];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");

console.log("===>LOADING main.js");


#include "main.window.js"
#include "main.icon.js"
#include "main.script-injection.js"
#include "main.network.js"
#include "main.cookies.js"
#include "main.storage.js"
#include "main.util.js"


const NewWindow = {
  newId: function(win) {
    var id;
    if (this._shouldBeDefault(win)) {
      id = Profile.DefaultIdentity;
    } else {
      id = Profile.lowerAvailableId(win);
    }
    console.log("newIdentity " + id);
    Profile.defineIdentity(win, id);
  },

  inheritId: function(newWin) {
    console.log("inheritId");
    var id;
    if (this._shouldBeDefault(newWin)) {
      id = Profile.DefaultIdentity;
    } else {
      //window.open()/fxstarting ==> opener=null
      var prevWin = newWin.opener;
      if (prevWin) {
        id = Profile.getIdentity(prevWin);
      } else {
        console.log("inheritId prevWin=" + prevWin);
        id = Profile.UnknownIdentity;
      }
    }
    Profile.defineIdentity(newWin, id);
    console.log("/inheritId " + id);
  },

  applyRestore: function(win) {
    // restore: window is first configured by NewWindow.inheritId
    console.log("applyRestore");

    var stringId = Cc["@mozilla.org/browser/sessionstore;1"]
                    .getService(Ci.nsISessionStore)
                    .getWindowValue(win, "${BASE_DOM_ID}-identity-id");
    var id = Profile.toInt(stringId);
    if (id < Profile.DefaultIdentity) { //UnknownIdentity?
      id = Profile.DefaultIdentity;
    }
    Profile.defineIdentity(win, id);
  },

  _shouldBeDefault: function(win) {
    // popup opened by an extension (like GTB)
    //var chromeHidden = win.document.documentElement.getAttribute("chromehidden");
    //return chromeHidden.indexOf("location") > -1;
    return false;
  }

};


const Profile = {
  UnknownIdentity: 0,
  DefaultIdentity: 1,
  MaxIdentity:     999999999999999,

  defineIdentity: function(win, id) {
    console.log("defineIdentity " + id);
    if (id > Profile.MaxIdentity) {
      console.log("id > max " + id);
      id = Profile.MaxIdentity;
    }
    if (id < Profile.UnknownIdentity) {
      console.log("id < UnknownIdentity " + id);
      id = Profile.UnknownIdentity;
    }
    var current = Profile.getIdentity(win);
    if (current === id) {
      console.log("defineIdentity NOP");
      return id;
    }
    if (current !== Profile.DefaultIdentity) {
      BrowserWindow.unregister(win);
    }

    this._save(win, id);
    BrowserWindow.register(win);
    updateUI(win);
    return id;
  },

  getIdentity: function(chromeWin) {
    var tabbrowser = chromeWin.getBrowser();
    if (tabbrowser === null) {
      console.log("getIdentity=DefaultIdentity, tabbrowser=null");
      return Profile.DefaultIdentity;
    }
    var id = tabbrowser.getUserData("${BASE_DOM_ID}-identity-id");
    return this.toInt(id);
  },

  _save: function(win, id) {
    console.log("save " + id);
    win.getBrowser().setUserData("${BASE_DOM_ID}-identity-id", id === Profile.DefaultIdentity ? null : id, null);
    new SaveToSessionStore(win.document);
  },

  activeIdentities: function(ignoreWin) {
    var winEnum = util2.browserWindowsEnum();
    var arr = [];
    while (winEnum.hasMoreElements()) {
      var win = winEnum.getNext();
      if (ignoreWin !== win) {
        var id = Profile.getIdentity(win);
        if (arr.indexOf(id) === -1) {
          arr.push(id);
        }
      }
    }
    return arr;
  },

  lowerAvailableId: function(ignoreWin) {
    var arr = this.activeIdentities(ignoreWin); //ignore win -- it doesn't have a session id yet
    var id = Profile.DefaultIdentity;
    while (arr.indexOf(id) > -1) {
      id++;
    }
    return id; // id is available
  },

  toInt: function(str) {
    var rv = parseInt(str, 10);
    return isNaN(rv) ? Profile.DefaultIdentity : rv;
  },

  toString: function(id) {
    switch (id) {
      //case Profile.UnknownIdentity:
      //  return "\u221e"; // ∞
      default:
        return id.toString();
    }
  }

};


function SaveToSessionStore(doc) {
  this._doc = doc;
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this._timer.init(this, 1300, Ci.nsITimer.TYPE_ONE_SHOT);
}

SaveToSessionStore.prototype = {

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  observe: function(aSubject, aTopic, aData) {
    console.log("SaveToSessionStore timer!");
    var doc = this._doc;
    if (doc.defaultView === null) {
      console.log("_syncToSessionStore window closed");
      return;
    }

    var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    var val = Profile.getIdentity(doc.defaultView);

    try {
      // overwrite any previous value if called twice
      ss.setWindowValue(doc.defaultView, "${BASE_DOM_ID}-identity-id", val);
    } catch (ex) {
      // keep trying
      util2.logEx("SaveToSessionStore FAIL", val, doc, doc.defaultView, doc.defaultView.state, ex);
      this._timer.init(this, 700, Ci.nsITimer.TYPE_ONE_SHOT);
      return;
    }

    if (val <= Profile.DefaultIdentity) { // UnknownIdentity OR DefaultIdentity
      ss.deleteWindowValue(doc.defaultView, "${BASE_DOM_ID}-identity-id");
    }

    console.log("_syncToSessionStore OK=" + Profile.getIdentity(doc.defaultView));
  }
};


const FindIdentity = {

  fromContent: function(contentWin) {
    if (contentWin === null) {
      return { profileNumber: Profile.UnknownIdentity };
    }

    var profileId;
    var browser = ContentWindow.getContainerElement(contentWin);
    if (browser === null) {
      // source-view?
      profileId = this._getIdentityFromOpenerChrome(contentWin);
      return { profileNumber: profileId };
    }

    var chromeWin = browser.ownerDocument.defaultView;
    profileId = Profile.getIdentity(chromeWin);
    if (profileId !== Profile.UnknownIdentity) {
      return { profileNumber: profileId, browserElement: browser };
    }

    // popup via js/window.open
    profileId = this._getIdentityFromOpenerContent(contentWin, chromeWin);
    return { profileNumber: profileId, browserElement: browser };
  },

  _getIdentityFromOpenerChrome: function(contentWin) {
    var chromeWin = ContentWindow.getChromeWindow(contentWin);
    if (chromeWin === null) {
      return Profile.UnknownIdentity;
    }
    var tabbrowser = null;
    var type = chromeWin.document.documentElement.getAttribute("windowtype");
    if (type === "navigator:view-source") {
      var winOpener = chromeWin.opener;
      if (winOpener) {
        var type2 = winOpener.document.documentElement.getAttribute("windowtype");
        if (type2 === "navigator:browser") {
          tabbrowser = winOpener.getBrowser();
        }
      }
    }

    return tabbrowser !== null ? Profile.getIdentity(tabbrowser.ownerDocument.defaultView)
                               : Profile.UnknownIdentity; // favicon, ...
  },

  _getIdentityFromOpenerContent: function(contentWin, chromeWin) {
    if (contentWin.opener) {
      var browserOpener = ContentWindow.getContainerElement(contentWin.opener);
      if (browserOpener) {
        var chromeOpener = browserOpener.ownerDocument.defaultView;
        var profileId = Profile.getIdentity(chromeOpener);
        if (profileId > Profile.UnknownIdentity) {
          return Profile.defineIdentity(chromeWin, profileId);
        }
      }
    }

    console.log("request [" + profileId + "] id.opener="+ profileId);
    return Profile.UnknownIdentity;
  }
};


const ContentWindow = {
  getContainerElement: function(contentWin) {
    var chromeWindow = this.getChromeWindow(contentWin);
    if ((chromeWindow !== null) && ("getBrowser" in chromeWindow)) {
      var tabbrowser = chromeWindow.getBrowser();
      var topDoc = contentWin.top.document;
      var idx = tabbrowser.getBrowserIndexForDocument(topDoc);
      if (idx > -1) {
        return tabbrowser.browsers[idx];
      }
    }
    return null;
  },

  getChromeWindow: function(contentWin) {
    var qi = contentWin.QueryInterface;
    if (!qi) {
      return null;
    }

    if (contentWin instanceof Ci.nsIDOMChromeWindow) {
      // extensions.xul, updates.xul ...
      return contentWin;
    }

    var win = qi(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIDocShell)
                .chromeEventHandler
                .ownerDocument
                .defaultView;
    // wrappedJSObject allows access to gBrowser etc
    // wrappedJSObject=undefined sometimes. e.g. contentWin=about:multifox
    var unwrapped = win.wrappedJSObject;
    return unwrapped ? unwrapped : win;
  }

};
