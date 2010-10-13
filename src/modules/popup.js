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

const EXPORTED_SYMBOLS = ["createMultifoxPopup"];

Components.utils.import("${URI_JS_MODULE}/new-window.js");

function createMultifoxPopup(icon, Profile) {
  var doc = icon.ownerDocument;
  var win = doc.defaultView;
  var profileId = Profile.getIdentity(win);

  var panel = doc.getElementById("multifox-popup");
  if (panel) {
    //bug
    win.alert("createMultifoxPopup dup popup " + panel.state);
    panel.hidePopup();
    return panel;
  }


  var p1 = util.getText("icon.panel.p1.label", "[(${URI_PACKAGENAME})]").split("[(${URI_PACKAGENAME})]");
  var p2 = util.getText("icon.panel.p2.label");


  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.margin = "0em 1em 0.7em 1.3em";

  var hx = container.appendChild(doc.createElement("hbox"));

  var img = hx.appendChild(doc.createElement("image"));
  var desc1 = container.appendChild(doc.createElement("box"));
  desc1.setAttribute("align", "center");
  var desc2 = container.appendChild(doc.createElement("description"));

  img.setAttribute("src", "${URI_PACKAGENAME}/content/logo-popup.png");
  img.style.marginLeft = "-10px";

  //desc1.setAttribute("control", "profileIdList");
  desc1.appendChild(doc.createElement("label")).setAttribute("value", p1[0]);

  /*
  var listProfile = desc1.appendChild(doc.createElement("menulist"));
  listProfile.setAttribute("id", "profileIdList");

  var menuProfile = listProfile.appendChild(doc.createElement("menupopup"));
  for (var idx = 2; idx < 7; idx++) {
    var itemProfile = menuProfile.appendChild(doc.createElement("menuitem"));
    itemProfile.setAttribute("label", idx);
  }
  */
  var editProfileId = desc1.appendChild(doc.createElement("textbox"));
  desc1.appendChild(doc.createElement("label")).setAttribute("value", p1[1]);
  desc2.appendChild(doc.createTextNode(p2));
  //desc1.style.fontWeight = "bold";


  if (profileId === Profile.UnknownIdentity) {
    desc2.hidden = true;
  }

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


  // options

/*
  var gbox = panel.appendChild(doc.createElement("groupbox"));
  var caption = gbox.appendChild(doc.createElement("caption"));
  var vboxOptions = gbox.appendChild(doc.createElement("vbox"));

  caption.setAttribute("label", "Opções do perfil de identidade");


  var hboxProfile = vboxOptions.appendChild(doc.createElement("hbox"));
  hboxProfile.setAttribute("align", "center");
  var labelProfile = hboxProfile.appendChild(doc.createElement("label"));
  labelProfile.setAttribute("control", "profileList");
  labelProfile.appendChild(doc.createTextNode("Perfil de identidade desta janela:"));


  var listProfile = hboxProfile.appendChild(doc.createElement("menulist"));
  listProfile.setAttribute("id", "profileList");

  var menuProfile = listProfile.appendChild(doc.createElement("menupopup"));
  for (var idx = 2; idx < 7; idx++) {
    var itemProfile = menuProfile.appendChild(doc.createElement("menuitem"));
    itemProfile.setAttribute("label", idx);
  }


  var cboxCookies = vboxOptions.appendChild(doc.createElement("checkbox"));
  cboxCookies.setAttribute("label", "Desativar cookies");

  var vboxButton = vboxOptions.appendChild(doc.createElement("hbox"));
  var butClear = vboxButton.appendChild(doc.createElement("button"));
  butClear.setAttribute("label", "Limpar dados do perfil");
*/



  // about button

  var h = container.appendChild(doc.createElement("hbox"));
  var spc = h.appendChild(doc.createElement("spacer"));
  spc.flex = 1;
  var but = h.appendChild(doc.createElement("button"));


  but.setAttribute("label", util.getText("icon.panel.button.label", "${EXT_NAME}"));
  but.addEventListener("command", function(evt) {
    var w = evt.target.ownerDocument.defaultView;
    w.openUILinkIn("about:multifox", "tab", false, null, null);
    panel.hidePopup();
  }, true);

  if (win.getBrowser().selectedBrowser.currentURI.spec === "about:multifox") {
    but.hidden = true;
  }

  panel.addEventListener("popupshowing", function(evt) {
    copyTheme(doc, panel, but);
    panel.style.width = "30em";
  }, false);

  panel.addEventListener("popupshown", function(evt) {
    but.focus();
  }, false);

  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  return panel;
}


function copyTheme(doc, panel, toBut) {
  var win = doc.defaultView;
  var fromBut = doc.getElementById("editBookmarkPanelDoneButton");

  copyCss(win, fromBut, toBut);
  copyCss(win, doc.getElementById("editBookmarkPanel"), panel);

  win.setTimeout(function() {
    // wait xbl
    var from  = doc.getAnonymousElementByAttribute(fromBut, "class", "box-inherit button-box");
    var to = doc.getAnonymousElementByAttribute(toBut, "class", "box-inherit button-box");
    to.setAttribute("style","");
    copyCss(win, from, to);
  }, 0);
}


function copyCss(win, from, to) {
  var style1 = win.getComputedStyle(from, "");
  var style2 = to.style;

  for (var name in style1) {
    if (style1[name]) {
      switch (name) {
        case "length":
        case "parentRule":
        case "display":
          continue;
      }
      if (name.indexOf("padding") === 0) {
        continue;
      }
      style2[name] = style1[name];
    }
  }

}
