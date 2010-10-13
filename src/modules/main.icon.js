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

function getIconNode(doc) {
  if (!doc) {
    util2.throwStack.go("getIconNode "+doc);
  }
  return doc.getElementById("multifox-icon");
}


function removeUI(doc) {
  util.log("removeUI");
  var icon = getIconNode(doc);
  if (icon) {
    icon.parentNode.removeChild(icon);
  }
}


function updateUI(win) {
  var profileId = Profile.getIdentity(win);
  util.log("updateUI " + profileId);

  var doc = win.document;
  if (profileId <= Profile.DefaultIdentity) {
    removeUI(doc);
    return;
  }

  var icon = getIconNode(doc);
  if (icon) {
    util.log("updateUI=" + profileId + " current=" + Profile.getIdentity(win));
    icon.querySelector("label").setAttribute("value", Profile.toString(profileId));
    return;
  }


  // <hbox align="center" id="multifox-icon">
  //   <box>
  //     <hbox align="center">
  //       <label value="100"/>


  var ref = doc.getElementById("urlbar-icons");
  var iconContainer = ref.appendChild(doc.createElement("hbox"));
  iconContainer.setAttribute("hidden", "true");
  iconContainer.setAttribute("id", "multifox-icon");


  if (profileId !== Profile.UnknownIdentity) {
    win.setTimeout(initIconCore, 250, iconContainer, profileId);
  }

}


function initIconCore(iconContainer, profileId) {
  var doc = iconContainer.ownerDocument;
  if (iconContainer !== getIconNode(doc)) {
    util.log("initIconCore != " + profileId + iconContainer + getIconNode(doc));
    return;
  }


  iconContainer.setAttribute("align", "center");
  iconContainer.style.margin = "0px 2px 0px 1px";

  var icon = iconContainer.appendChild(doc.createElement("box"));
  icon.setAttribute("tooltiptext", "${EXT_NAME}");


  var styleIcon = icon.style;
  styleIcon.padding = "0px";
  styleIcon.margin = "0px";
  styleIcon.background = "transparent repeat-x";
  styleIcon.MozBorderRadius = "2px";
  styleIcon.minHeight = "16px";


  var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
  switch (os) {
    case "Darwin":
      styleIcon.backgroundImage = "url(${URI_PACKAGENAME}/content/icon-osx.png)";
      styleIcon.backgroundColor = "#416ea5";
      break;
    case "WINNT":
      styleIcon.backgroundImage = "url(${URI_PACKAGENAME}/content/icon.png)";
      styleIcon.backgroundColor = "#4ab0f6";
      break;
    default:
      styleIcon.backgroundImage = "url(${URI_PACKAGENAME}/content/icon-linux.png)";
      styleIcon.backgroundColor = "#6184c3";
      break;
  }



  var labelContainer = icon.appendChild(doc.createElement("hbox"));
  labelContainer.setAttribute("align", "center");


  var lb = labelContainer.appendChild(doc.createElement("label"));
  lb.setAttribute("value", Profile.toString(profileId));
  var styleLabel = lb.style;

  styleLabel.color = "white";
  styleLabel.fontWeight = "bold";
  styleLabel.fontStyle = "normal";
  styleLabel.textRendering = "optimizelegibility";
  styleLabel.textShadow = "1px 1px 1px black";
  styleLabel.padding = "0px 9px";
  styleLabel.margin = "-1px 0px";

  initIconNormal(icon);
  iconContainer.removeAttribute("hidden");
}


function initIconNormal(icon) {
  icon.ownerDocument.defaultView.setTimeout(function() {
    // workaround
    // otherwise, mousedown on icon will close and open popup, even with stopPropagation
    icon.addEventListener("mousedown", openMultifoxPopup, false);
  }, 0);
  icon.addEventListener("mouseover", onIconHover, false);
  icon.addEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt 0pt";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black";
}


function initIconPressed(icon) { // openpopup
  icon.removeEventListener("mousedown", openMultifoxPopup, false);
  icon.removeEventListener("mouseover", onIconHover, false);
  icon.removeEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt -64px";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
}


function onIconHover(evt) {
  var icon = getIconNode(evt.target.ownerDocument).firstChild;

  switch (evt.type) {
    case "mouseover":
      icon.style.backgroundPosition = "0pt -32px";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
      break;
    case "mouseout":
      icon.style.backgroundPosition = "0pt 0pt";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black";
      break;
  }
}


/*
// show/hide [1] "icon"
function toggleDefaultWindowUI(show) {
  var winEnum = util2.browserWindowsEnum();
  while (winEnum.hasMoreElements()) {
    var doc = winEnum.getNext().document;
    if (Profile.getIdentity(doc) === Profile.DefaultIdentity) {
      if (show) {
        updateUI(doc, Profile.DefaultIdentity);
      } else {
        removeUI(doc);
      }
    }
  }
}
*/


function openMultifoxPopup(evt) {
  Components.utils.import("${URI_JS_MODULE}/popup.js");
  var icon = evt.currentTarget; //or this

  var panel = createMultifoxPopup(icon, Profile);
  initIconPressed(icon);

  panel.addEventListener("popuphidden", function(evt) {
    initIconNormal(icon);
  }, false);

  panel.openPopup(icon, "after_end", 0, 1);
}
