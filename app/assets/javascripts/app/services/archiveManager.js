import { PrivilegesManager } from '@/services/privilegesManager';
import { protocolManager } from 'snjs';

export class ArchiveManager {
  /* @ngInject */
  constructor(passcodeManager, authManager, modelManager, privilegesManager) {
    this.passcodeManager = passcodeManager;
    this.authManager = authManager;
    this.modelManager = modelManager;
    this.privilegesManager = privilegesManager;
  }

  /*
  Public
  */

  async downloadBackup(encrypted) {
    return this.downloadBackupOfItems(this.modelManager.allItems, encrypted);
  }

  async downloadBackupOfItems(items, encrypted) {
    let run = async () => {
      // download in Standard Notes format
      this.__itemsData(items, encrypted).then((data) => {
        let modifier = encrypted ? "Encrypted" : "Decrypted";
        this.__downloadData(data, `Standard Notes ${modifier} Backup - ${this.__formattedDate()}.txt`);

        // download as zipped plain text files
        if(!keys) {
          this.__downloadZippedItems(items);
        }
      })
    }

    if(await this.privilegesManager.actionRequiresPrivilege(PrivilegesManager.ActionManageBackups)) {
      this.privilegesManager.presentPrivilegesModal(PrivilegesManager.ActionManageBackups, () => {
        run();
      });
    } else {
      run();
    }
  }

  /*
  Private
  */

  __formattedDate() {
    var string = `${new Date()}`;
    // Match up to the first parenthesis, i.e do not include '(Central Standard Time)'
    var matches = string.match(/^(.*?) \(/);
    if(matches.length >= 2) {
      return matches[1]
    }
    return string;
  }

  async __itemsData(items, encrypted) {
    const keyParams = encrypted ? await protocolManager.getRootKeyKeyParams() : null;
    let data = await this.modelManager.getJSONDataForItems(items, keyParams);
    let blobData = new Blob([data], {type: 'text/json'});
    return blobData;
  }

  __loadZip(callback) {
    if(window.zip) {
      callback();
      return;
    }

    var scriptTag = document.createElement('script');
    scriptTag.src = "/assets/zip/zip.js";
    scriptTag.async = false;
    var headTag = document.getElementsByTagName('head')[0];
    headTag.appendChild(scriptTag);
    scriptTag.onload = function() {
      zip.workerScriptsPath = "assets/zip/";
      callback();
    }
  }

  __downloadZippedItems(items) {
    this.__loadZip(() => {
      zip.createWriter(new zip.BlobWriter("application/zip"), (zipWriter) => {
        var index = 0;

        let nextFile = () => {
          var item = items[index];
          var name, contents;

          if(item.content_type == "Note") {
            name = item.content.title;
            contents = item.content.text;
          } else {
            name = item.content_type;
            contents = JSON.stringify(item.content, null, 2);
          }

          if(!name) {
            name = "";
          }

          var blob = new Blob([contents], {type: 'text/plain'});

          var filePrefix = name.replace(/\//g, "").replace(/\\+/g, "");
          var fileSuffix = `-${item.uuid.split("-")[0]}.txt`

          // Standard max filename length is 255. Slice the note name down to allow filenameEnd
          filePrefix = filePrefix.slice(0, (255 - fileSuffix.length));

          let fileName = `${item.content_type}/${filePrefix}${fileSuffix}`

          zipWriter.add(fileName, new zip.BlobReader(blob), () => {
            index++;
            if(index < items.length) {
              nextFile();
            } else {
              zipWriter.close((blob) => {
                this.__downloadData(blob, `Standard Notes Backup - ${this.__formattedDate()}.zip`);
                zipWriter = null;
              });
            }
          });
        }

        nextFile();
      }, onerror);
    })
  }


  __hrefForData(data) {
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (this.textFile !== null) {
      window.URL.revokeObjectURL(this.textFile);
    }

    this.textFile = window.URL.createObjectURL(data);

    // returns a URL you can use as a href
    return this.textFile;
  }

  __downloadData(data, fileName) {
    var link = document.createElement('a');
    link.setAttribute('download', fileName);
    link.href = this.__hrefForData(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
