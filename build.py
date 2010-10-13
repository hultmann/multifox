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

import os
from os.path import join
import string
import datetime
import shutil
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
import hashlib


def createDirStructure(unpackedDir):
  os.mkdir(unpackedDir)
  for myDir in ['modules',
                'content',
                'components',
                'defaults',
                'defaults/preferences',
                'locale',
                'locale/en-US',
                'locale/es-ES',
                'locale/pt-BR']:

    os.mkdir(unpackedDir + '/' + myDir)
    #os.makedirs


def copyBinaryFiles(sourceDir, unpackedDir):
  files = [
    '/content/logo-about.png',
    '/content/logo-popup.png',
    '/content/logo-icon.png',
    '/content/icon.png',
    '/content/icon-linux.png',
    '/content/icon-osx.png'
  ];

  for myFile in files:
    shutil.copy(sourceDir + myFile, unpackedDir + myFile)


def copyTextFiles(sourceDir, unpackedDir, dic):
  files = [
    '/install.rdf',
    '/chrome.manifest',

    '/content/content-injection.js',
    '/content/browser.xul',
    '/content/places.xul',
    '/content/about.xul',
    '/content/about-multifox.html',

    '/components/protocol.js',

    '/modules/new-window.js',
    '/modules/menus.js',
    '/modules/error.js',
    '/modules/popup.js',

    '/defaults/preferences/prefs.js',

    '/locale/en-US/about.html',
    '/locale/es-ES/about.html',
    '/locale/pt-BR/about.html',
    '/locale/en-US/general.properties',
    '/locale/es-ES/general.properties',
    '/locale/pt-BR/general.properties'
  ]

  for myFile in files:
    parseTextFile(sourceDir + myFile, unpackedDir + myFile, dic);


def buildModule(sourceDir, unpackedDir, dic):
  buf = ''
  files = [
    '/modules/main.main.js',
    '/modules/main.window.js',
    '/modules/main.icon.js',
    '/modules/main.script-injection.js',
    '/modules/main.network.js',
    '/modules/main.windowproperties.js',
    '/modules/main.cookies.js',
    '/modules/main.storage.js',
    '/modules/main.util.js'
  ]

  for myFile in files:
    f = open(sourceDir + myFile, 'r')
    buf += string.Template(f.read()).safe_substitute(dic)
    f.close()

  m = open(unpackedDir + '/modules/main.js', 'w')
  m.write(buf)
  m.close()


def parseTextFile(inputPath, outputPath, dic):
  f = open(inputPath, 'r')
  buf = string.Template(f.read()).safe_substitute(dic)
  f.close()

  f = open(outputPath, 'w')
  f.write(buf)
  f.close()


def createUnpacked(sourceDir, unpackedDir, dic):
  if os.path.exists(unpackedDir):
    shutil.rmtree(unpackedDir)
  createDirStructure(unpackedDir)
  copyBinaryFiles(sourceDir, unpackedDir)
  copyTextFiles(sourceDir, unpackedDir, dic)
  buildModule(sourceDir, unpackedDir, dic)   #main.js


def createXpi(unpackedDir, xpi_file):
  zip = ZipFile('build/xpi/' + xpi_file, 'w', ZIP_DEFLATED)
  for root, dirs, files in os.walk(unpackedDir):
    for name in files:
      t = join(root, name)
      zip.write(t, t.replace(unpackedDir + '\\', ''))
  zip.close()


def getHash(path):
  f = open(path, 'rb')
  h = hashlib.sha512()
  while True:
    data = f.read(8192)
    if data:
      h.update(data)
    else:
      break
  f.close()
  return 'sha512:' + h.hexdigest()



unpackedDir = 'build/unpacked'
packageName = 'multifox'
jsModule = 'multifox-modules'
version = '1.2.0'

srcVars = {
            'PACKAGENAME':      packageName,
            'URI_PACKAGENAME':  'chrome://' + packageName,
            'JS_MODULE':        jsModule,
            'URI_JS_MODULE':    'resource://' + jsModule,
            'BASE_DOM_ID':      'multifox-dom',

            'APP_MIN_VERSION':  '3.6.3',
            'APP_MAX_VERSION':  '3.6.*',

            'EXT_ID':           'multifox@hultmann',
            'EXT_NAME':         'Multifox',
            'EXT_VERSION':      version,
            'EXT_SITE':         'http://br.mozdev.org/multifox/',

            'XPI_HASH':         '[TBD]',
            'XPI_NAME':         'multifox-' + version + '.xpi'
          }


createUnpacked('src', unpackedDir, srcVars)

createXpi(unpackedDir, srcVars['XPI_NAME'])

srcVars['XPI_HASH'] = getHash('build/xpi/' + srcVars['XPI_NAME'])

parseTextFile('src/update.rdf', 'build/update.rdf', srcVars)
