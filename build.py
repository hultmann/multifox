#!/usr/bin/python
# -*- coding: utf-8 -*-

# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Multifox.
#
# The Initial Developer of the Original Code is
# Jeferson Hultmann <hultmann@gmail.com>
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

import build_tools

b = build_tools.BuildExtension()

b.add_binary("icon.png")
b.add_binary("content/favicon.ico")
b.add_binary("content/logo-about.png")
b.add_binary("content/logo-popup.png")


b.add_text("install.rdf")
b.add_text("chrome.manifest")
b.add_text("components/protocol.js")
b.add_text("defaults/preferences/prefs.js")

b.add_text("content/content-injection.js")
b.add_text("content/content-injection-192.js")
b.add_text("content/overlays.js")
b.add_text("content/about-multifox.html")
b.add_text("content/about-multifox.js")
b.add_text("content/about-badges.html")

b.add_text("modules/new-window.js")
b.add_text("modules/main.js")
b.add_text("modules/error.js")
b.add_text("modules/popup.js")
b.add_text("modules/welcome.js")


b.add_locale("en-US")
#b.add_locale("pt-BR")
#b.add_locale("es-ES")


b.add_text("locale/${locale}/general.properties")
b.add_text("locale/${locale}/about.properties")
b.add_text("locale/${locale}/welcome.properties")


b.set_var("EXT_VERSION",     "2.0b5pre")
b.set_var("EXT_ID",          "multifox@hultmann")
b.set_var("EXT_NAME",        "Multifox (BETA)")
b.set_var("EXT_SITE",        "http://br.mozdev.org/multifox/")
b.set_var("APP_MIN_VERSION", "10.0")
b.set_var("APP_MAX_VERSION", "12.*")
b.set_var("CHROME_NAME",     "multifox")
b.set_var("RESOURCE_NAME",   "multifox-modules")
b.set_var("PATH_CONTENT",    "chrome://multifox/content")
b.set_var("PATH_LOCALE",     "chrome://multifox/locale")
b.set_var("PATH_MODULE",     "resource://multifox-modules")

b.set_var("BASE_DOM_ID",            "multifox-dom")

b.set_var("INTERNAL_DOMAIN_SUFFIX_LOGGEDIN", "multifox-auth-1")
b.set_var("INTERNAL_DOMAIN_SUFFIX_ANON",     "multifox-anon-1") #external anon 3party

b.set_var("XPCOM_ABOUT_CLASS",      "{347c41b6-1417-411c-b87a-422bcfc1899a}")
b.set_var("XPCOM_ABOUT_CONTRACT",   "@mozilla.org/network/protocol/about;1?what=multifox")

b.set_var("XPCOM_STARTUP_CLASS",    "{56c5d3a5-e39c-4131-af85-ebee4fceb792}")
b.set_var("XPCOM_STARTUP_CONTRACT", "@hultmann/multifox/bg;1")

xpi = b.get_var("CHROME_NAME") + "-" + b.get_var("EXT_VERSION") + ".xpi"
b.build("src", "build", xpi)
