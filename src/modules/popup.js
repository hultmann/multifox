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
 * Portions created by the Initial Developer are Copyright (C) 2010
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

"use strict";

const EXPORTED_SYMBOLS = ["createMultifoxPopup"];

Components.utils.import("${PATH_MODULE}/new-window.js");

function createMultifoxPopup(icon, Profile) {
  var doc = icon.ownerDocument;
  var win = doc.defaultView;

  var panel = doc.getElementById("multifox-popup");
  if (panel) {
    //bug
    win.alert("createMultifoxPopup dup popup " + panel.state);
    panel.hidePopup();
    return panel;
  }

  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.margin = "1.2em 1.4em";
  container.style.width = "30em";

  var but = appendError(container, panel);
  appendLogo(container);
  appendProfileId(container, icon, Profile.getIdentity(win), Profile);
  var link = appendAbout(container, panel);

  panel.addEventListener("popupshown", function(evt) {
    link.focus();
  }, false);

  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  return panel;
}


function appendError(container, panel) {
  var browser = container.ownerDocument.defaultView.getBrowser().selectedBrowser;
  var error = browser.hasAttribute("multifox-tab-status")
                ? browser.getAttribute("multifox-tab-status") : "";
  if (error.length === 0) {
    return null;
  }
  Components.utils.import("${PATH_MODULE}/error.js");
  return appendErrorToPanel(container, panel, error);
}


function appendAbout(container, panel) {
  var doc = container.ownerDocument;
  var box = container.appendChild(doc.createElement("hbox"));
  var spc = box.appendChild(doc.createElement("spacer"));
  spc.flex = 1;

  var link = box.appendChild(doc.createElement("label"));
  link.setAttribute("value", util.getText("icon.panel.link.label", "${EXT_NAME}"));
  link.setAttribute("class", "text-link");
  link.addEventListener("click", function(evt) {
    if (evt.button !== 0) {
      return;
    }

    panel.hidePopup();

    Components.utils.import("resource://gre/modules/Services.jsm");
    var uri = Services.io.newURI("about:multifox", null, null);
    var win = evt.target.ownerDocument.defaultView;
    var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
    win.browserDOMWindow.openURI(uri, null, where, null);

  }, false);

  var selectedUri = doc.defaultView.getBrowser().selectedBrowser.currentURI;
  if (selectedUri.spec === "about:multifox") {
    link.setAttribute("hidden", "true");
  }

  return link;
}


function appendLogo(container) {
  var doc = container.ownerDocument;
  var box = container.appendChild(doc.createElement("hbox"));
  var img = box.appendChild(doc.createElement("image"));
  img.setAttribute("src", "${PATH_CONTENT}/logo-popup.png");
  img.setAttribute("width", "175");
  img.setAttribute("height", "97");
  img.style.marginLeft = "-10px";
}


function appendProfileId(container, icon, profileId, Profile) {
  var doc = container.ownerDocument;

  var desc1 = container.appendChild(doc.createElement("box"));
  desc1.setAttribute("align", "center");
  var desc2 = container.appendChild(doc.createElement("description"));

  var p1 = util.getText("icon.panel.p1.label", "[${PATH_CONTENT}]").split("[${PATH_CONTENT}]");
  desc1.appendChild(doc.createElement("label")).setAttribute("value", p1[0]);

  var editProfileId = desc1.appendChild(doc.createElement("textbox"));
  desc1.appendChild(doc.createElement("label")).setAttribute("value", p1[1]);

  editProfileId.setAttribute("type", "number");
  editProfileId.setAttribute("size", "1");
  editProfileId.setAttribute("min", "2");
  editProfileId.setAttribute("max", Profile.MaxIdentity);
  editProfileId.setAttribute("value", profileId);

  editProfileId.addEventListener("change", function(evt) {
    var icon = evt.target;
    var win = icon.ownerDocument.defaultView;
    var id = icon.valueNumber;
    icon.valueNumber = Profile.defineIdentity(win, id);
  }, false);

  var p2 = util.getText("icon.panel.p2.label");
  desc2.appendChild(doc.createTextNode(p2));

  if (profileId === Profile.UndefinedIdentity) {
    desc2.hidden = true;
  }
}
