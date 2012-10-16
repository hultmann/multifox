/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// <vbox>  <== box
//   <hbox>  <== box2
//     <image/>
//     <vbox>  <== box3
//       <description/>
//       <hbox>  <== box4
//         <button/>

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

  return but;
}


function moveTabToDefault(button) {
  var tab = UIUtils.getSelectedTab(button.ownerDocument.defaultView);
  var docUser = WinMap.setTabAsNewAccount(getIdFromTab(tab));
  updateUIAsync(tab, true); // show new user now (see loadTab function)

  moveData_toDefault(docUser);
  tab.linkedBrowser.loadURIWithFlags(tab.linkedBrowser.contentDocument.documentURI,
                                     Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
}


function moveData_toDefault(docUser) {
  var tabTld = docUser.ownerTld;

  //removeTldData_cookies(tabTld);

  var all = removeTldData_cookies(docUser.appendLogin(tabTld));
  console.log("===>moveData_toDefault", tabTld, docUser.toString(), "cookies:", all.length);
  var cookie;
  var realHost;
  for (var idx = all.length - 1; idx > -1; idx--) {
    cookie = all[idx];
    realHost = UserUtils.getRealHost(cookie.host);
    if (realHost !== null) {
      copyCookieToNewHost(cookie, realHost);
    }
  }

  var all2 = removeTldData_LS(tabTld);
}
