/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ErrorHandler = {
  _incompatibility: false,

  // incompatible extension installed
  addIncompatibilityError: function() {
    this._incompatibility = true;
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
    return button !== null ? button.getAttribute("tab-status") : "";
  },


  updateButtonAsync: function(browser) {
    browser.ownerDocument.defaultView.mozRequestAnimationFrame(function() {
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
    var showingError = button.getAttribute("tab-status").length > 0;
    if (isError === showingError) {
      return;
    }
    if (isError) {
      button.setAttribute("image", "chrome://global/skin/icons/warning-16.png");
      button.setAttribute("tab-status", newStat);
    } else {
      button.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
      button.setAttribute("tab-status", "");
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
