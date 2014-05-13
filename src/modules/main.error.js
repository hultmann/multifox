/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ErrorHandler = {
  _incompatibility: false,

  // incompatible extension installed
  addIncompatibilityError: function() {
    // this=undefined
    ErrorHandler._incompatibility = true;
    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      ErrorHandler.updateButtonAsync(enumWin.getNext().getBrowser().selectedBrowser);
    }
  },


  // request/response
  addNetworkError: function(contentWin, errorCode) {
    var browser = ContentWindow.getContainerElement(contentWin);
    browser.setAttribute("multifox-tab-error-net", errorCode);
    this.updateButtonAsync(browser);
  },


  // evalInSandbox/runtime
  addScriptError: function(contentWin, errorCode, details) {
    var msg = [];
    msg.push("ERROR=" + errorCode);
    msg.push(details);
    if (contentWin.document) {
      msg.push("location=" + contentWin.location);
      if (contentWin.document.documentURIObject) {
        msg.push("uri=     " + contentWin.document.documentURIObject.spec);
      }
    }
    msg.push("title=[" + contentWin.document.title + "]");
    console.log(msg.join("\n"));

    var browser = ContentWindow.getContainerElement(contentWin);
    browser.setAttribute("multifox-tab-error-script", errorCode);
    this.updateButtonAsync(browser);
  },


  onNewWindow: function(win, browser) {
    // reset js error
    if ((win === win.top) && (browser !== null)) {
      if (browser.hasAttribute("multifox-tab-error-script")) {
        browser.removeAttribute("multifox-tab-error-script");
        this.updateButtonAsync(browser);
      }
    }
  },


  onNewWindowRequest: function(browser) {
    // reset network error - BUG new win is chrome:// (no http-on-modify-request)
    if (browser.hasAttribute("multifox-tab-error-net")) {
      browser.removeAttribute("multifox-tab-error-net");
      this.updateButtonAsync(browser);
    }
  },


  getCurrentError: function(doc) {
    var button = getButtonElem(doc);
    if (button === null) {
      return "";
    }
    return button.hasAttribute("tab-status")
         ? button.getAttribute("tab-status")
         : "";
  },


  updateButtonAsync: function(browser) {
    browser.ownerDocument.defaultView.requestAnimationFrame(function() {
      ErrorHandler._updateButtonStatus(browser);
    });
  },


  _updateButtonStatus: function(browser) {
    if (browser.getTabBrowser().selectedBrowser !== browser) {
      return;
    }

    var button = getButtonElem(browser.ownerDocument);
    if (button === null) { // view-source?
      return;
    }

    if (this._incompatibility) {
      this._update("incompatible-extension", button);
      return;
    }

    if (browser.hasAttribute("multifox-tab-error-net")) {
      this._update(browser.getAttribute("multifox-tab-error-net"), button);
      return;
    }

    this._update(this._getJsError(browser), button);
  },


  _update: function(newStat, button) {
    var isError = newStat.length > 0;
    var showingError = ErrorHandler.getCurrentError(button.ownerDocument).length > 0;
    if (isError === showingError) {
      return;
    }

    if (isError) {
      button.setAttribute("tab-status", newStat);
    } else {
      button.removeAttribute("tab-status");
    }
  },


  _getJsError: function(browser) {
    if (browser.hasAttribute("multifox-tab-error-script")) {
      return browser.getAttribute("multifox-tab-error-script");
    }
    // multifox-tab-error refers to a different document.
    // it seems the current is fine.
    return "";
  }

};



var ExtCompat = {

  // Extensions with known compatibility issues.
  // To update it please file a bug: https://github.com/hultmann/multifox/issues
  _incompatIds: [
    "{37fa1426-b82d-11db-8314-0800200c9a66}", // X-notifier
    "{42f25d10-4944-11e2-96c0-0b6a95a8daf0}"  // former Multifox 2
  ],


  findIncompatibleExtensions: function(onFound) {
    var jsm = {};
    Components.utils.import("resource://gre/modules/AddonManager.jsm", jsm);
    jsm.AddonManager.getAddonsByIDs(this._incompatIds, function(arr) {
      var enabled = [];
      for (var idx = arr.length - 1; idx > -1; idx--) {
        var ext = arr[idx];
        if ((ext !== null) && ext.isActive) {
          enabled.push(ext.name);
        }
      }
      if (enabled.length > 0) {
        onFound(enabled);
      }
    });
  },


  _addonListener: {
    onEnabled: function(addon) {
      if (ExtCompat._incompatIds.indexOf(addon.id) > -1) {
        ErrorHandler.addIncompatibilityError();
      }
    },

    onDisabled: function(addon) {
      if (ExtCompat._incompatIds.indexOf(addon.id) > -1) {
        ExtCompat.findIncompatibleExtensions(ErrorHandler.addIncompatibilityError);
      }
    }
  },


  installAddonListener: function() {
    var jsm = {};
    Components.utils.import("resource://gre/modules/AddonManager.jsm", jsm);
    jsm.AddonManager.addAddonListener(this._addonListener);
  },


  uninstallAddonListener: function() {
    var jsm = {};
    Components.utils.import("resource://gre/modules/AddonManager.jsm", jsm);
    jsm.AddonManager.removeAddonListener(this._addonListener);
  }

};
