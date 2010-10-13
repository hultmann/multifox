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

const EXPORTED_SYMBOLS = ["showError"];

Components.utils.import("${URI_JS_MODULE}/new-window.js");
Components.utils.import("${URI_JS_MODULE}/main.js");

function showError(contentWin, notSupportedFeature) {
  var browser = new WindowProperties(contentWin).browser;
  var contentDoc = contentWin.document;

  if (browser === null) {
    browser = util.mostRecentWindow().getBrowser().selectedBrowser;
  }

  var msg = [];
  msg.push("ERROR " + notSupportedFeature);
  msg.push(contentDoc ? contentDoc.location : "?");
  msg.push("title [" + contentDoc.title + "]");
  msg.push(contentDoc.__defineSetter__);
  msg.push(contentDoc.wrappedJSObject.__defineSetter__);
  msg.push(browser);
  util.log(msg.join("\n"));

  var name = "multifox-not-supported";
  var infobarSet = browser.getTabBrowser().getNotificationBox(browser);
  if (infobarSet.getNotificationWithValue(name)) {
    return;
  }

  var buttonConfig = [{
    _browser: browser,
    callback: onInfobarCommand,
    label: util.getText("infobar.unsupported.button.label"),
    accessKey: util.getText("infobar.unsupported.button.accesskey")
  }];

  infobarSet.appendNotification(
    util.getText("infobar.unsupported.content", "Multifox"),
    name,
    "chrome://global/skin/icons/warning-16.png",
    infobarSet.PRIORITY_INFO_MEDIUM,
    buttonConfig);
}


function onInfobarCommand(infobar, buttonConfig) {
  var winEnum = Cc["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Ci.nsIWindowMediator)
                  .getEnumerator("navigator:browser");

  var targetWin = null;
  while (winEnum.hasMoreElements()) {
    var tmpWin = winEnum.getNext();
    if (Profile.getIdentity(tmpWin) === Profile.DefaultIdentity) { //isDefaultWindow
      targetWin = tmpWin;
      break;
    }
  }


  var sourceWin = buttonConfig._browser.ownerDocument.defaultView;
  var sourceTab = sourceWin.getBrowser().selectedTab;

  if (targetWin === null) {
    // there is no default window => next identity will be default
    newPendingWindow();
    targetWin = sourceWin.OpenBrowserWindow();
    targetWin.addEventListener("load", function(evt) {
      moveTab(targetWin, sourceTab, true);
    }, false);
  } else {
    moveTab(targetWin, sourceTab, false);
  }

  return true; // don't close infobar (open new window faster)
}


function moveTab(targetWin, sourceTab, isNewWin) {
  targetWin.setTimeout(function() { // workaround to avoid exceptions
    var targetTabBrowser = targetWin.getBrowser();
    var targetTab;

    if (isNewWin) {
      targetTab = targetTabBrowser.selectedTab;
    } else {
      var props = {
        allowThirdPartyFixup: false,
        relatedToCurrent: false,
        referrerURI: null,
        charset: null,
        postData: null,
        ownerTab: null
      };
      targetTab = targetTabBrowser.addTab("about:blank", props);
    }

    targetTab.linkedBrowser.stop();   // avoid exception in tabbrowser.setAndLoadFaviconForPage
    targetTab.linkedBrowser.docShell; // make sure tab has a docshell
    targetTabBrowser.swapBrowsersAndCloseOther(targetTab, sourceTab);
    targetTabBrowser.selectedTab = targetTab;
    targetTabBrowser.contentWindow.focus();
  }, 0);
}
