/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const EXPORTED_SYMBOLS = ["appendErrorToPanel"];

Components.utils.import("${PATH_MODULE}/new-window.js");
Components.utils.import("${PATH_MODULE}/main.js");

// <vbox>  <== box
//   <hbox>  <== box2
//     <image/>
//     <vbox>  <== box3
//       <description/>
//       <hbox>  <== box4
//         <button/>
//   <separator/>

function appendErrorToPanel(box, panel) {
  var doc = box.ownerDocument;

  var box2 = box.appendChild(doc.createElement("hbox"));
  box2.setAttribute("align", "center");

  var img = box2.appendChild(doc.createElement("image"));
  img.setAttribute("src", "chrome://global/skin/icons/warning-large.png");
  img.setAttribute("width", "48");
  img.setAttribute("height", "48");
  img.style.marginRight = "8px";

  var box3 = box2.appendChild(doc.createElement("vbox"));
  box3.setAttribute("flex", "1");

  var txt = util.getText("icon.panel.unsupported-general.label", "${EXT_NAME}");
  box3.appendChild(doc.createElement("description"))
      .appendChild(doc.createTextNode(txt));

  var but = box3.appendChild(doc.createElement("hbox")).appendChild(doc.createElement("button"));
  but.setAttribute("label", util.getText("icon.panel.make-tab-default.button.label", "${EXT_NAME}"));
  but.setAttribute("accesskey", util.getText("icon.panel.make-tab-default.button.accesskey"));
  but.addEventListener("command", function(evt) {
    panel.hidePopup();
    moveTabToDefault(but);
  }, false);


  var sep = box.appendChild(doc.createElement("separator"));
  sep.setAttribute("class", "groove");
  sep.style.margin = "1.2em 0";

  return but;
}


function moveTabToDefault(button) {
  var sourceWin = button.ownerDocument.defaultView;
  var sourceTab = sourceWin.getBrowser().selectedTab;

  Components.utils.import("resource://gre/modules/Services.jsm");
  var winEnum = Services.wm.getEnumerator("navigator:browser");
  var targetWin = null;

  while (winEnum.hasMoreElements()) {
    var tmpWin = winEnum.getNext();
    if (Profile.getIdentity(tmpWin) === Profile.DefaultIdentity) { //isDefaultWindow
      targetWin = tmpWin;
      break;
    }
  }

  if (targetWin !== null) {
    moveTab(targetWin, sourceTab, false);
    return;
  }

  // there is no default window => next identity will be default
  newPendingWindow();
  targetWin = sourceWin.OpenBrowserWindow();
  targetWin.addEventListener("load", function(evt) {
    moveTab(targetWin, sourceTab, true);
  }, false);
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
    targetTabBrowser.selectedTab.linkedBrowser.reload();
  }, 0);
}
