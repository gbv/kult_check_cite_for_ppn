/*
- use list as referenz only and not as loop source
- just use a pointer: current object, current ppn
- if reqest is done, increase pointer and start next reqest
- initial pointer is ppnList.response.docs[0].MD_NLD_LITERATUREQUOTATION[0]
- we need a bundle of functions
  - add ppn to ppn blacklist
  - add ppn to pi blacklist
  - get cite from suggest

  program:
  - check if ppn is in black list
  - if not get cite
  - if cite is correct, increase pointer, check next ppn
  - if cite is not correct
    - check ppn with leading zero
    - if cite is now correct, set new status
    - if not check if ppn is in catalog
    - if it is not linked, set new status
    - add ppn to black lists with its status
    - increase pointer and check next ppn

    TODO - change blacklist architecture to avoid problems with bad ppn strings like
    "Das 1000jährige Stift Fischbeck – Geschichte und bauliche Entwicklung": "reason unknown"
*/
var debugMode = true;
var wrongPIs  = new Object();
var wrongPPNs = new Object();
var ppnCheckResults = {
  "PPNBlackList":[],
  "PPNWhiteList":[],
  "wrongPPNsByPI":[]
};
/*
{
  PPNBlackList: ["1234578","12345678"],
  PPNWhiteList: ["1235678","12345678"],
  wrongPPNsByPI: [
    {
      "PI":"1234578",
      "PPN":[
        {
          id:"1234578",
          status:"unknown"
        }
      ]
    }
  ]
}
*/
var workingPPNs = new Object();
var pointer = {"PI":0, "PPN":0};
var currentPI = "not set yet: ";
var currentPPN = "not set yet: ";
var currentEntry = "not set yet: ";
var requestCounter = 0;

$( document ).ready( function() {

  var shortData = "allPpn-zero-check.json";
  var longData = "allPpn-2023-08-30.json";
  var solrQuery = "https://denkmalatlas.niedersachsen.de/solr/collection1/select?q=MD_NLD_LITERATUREQUOTATION%3A*&rows=100000&fl=PI%2C+MD_NLD_LITERATUREQUOTATION&wt=json&indent=true";

  $.getJSON( solrQuery, {
    format: "json"
    })
    .done(function( ppnSource ) {
      logToPage("debug","Document is ready. JSON loaded.");
      if (debugMode) logToConsole(ppnSource);
      if (debugMode) logToConsole(pointer);
      checkPPNs( ppnSource );
    });

});

function checkPPNs( ppnSource ) {
  currentPI = ppnSource.response.docs[pointer.PI].PI;
  currentPPN = ppnSource.response.docs[pointer.PI].MD_NLD_LITERATUREQUOTATION[pointer.PPN];
  currentEntry = "[PI: " + currentPI + ", PPN: " + currentPPN + "] ";

  // only check new ppns
  if (ppnCheckResults.PPNBlackList.includes(currentPPN) || ppnCheckResults.PPNWhiteList.includes(currentPPN)) {
    logToPage("debug", currentEntry + "PPN was checked before.");

    // ppn is already in blacklist
    if (ppnCheckResults.PPNBlackList.includes(currentPPN)) {
      logToPage("debug", currentEntry + "PPN is known as issue.");
      // update pi result list
      if (ppnCheckResults.wrongPPNsByPI.some((object) => object.PI === currentPI )) {
        let key = ppnCheckResults.wrongPPNsByPI.findIndex(object => object.PI === currentPI);
        ppnCheckResults.wrongPPNsByPI[key].PPN.push({"id":currentPPN,"status":"reason unknown"});
        logToPage("debug", currentEntry + "PI exists in result list. append ppn.");
      } else {
        ppnCheckResults.wrongPPNsByPI.push({"PI":currentPI,"PPN":[{"id":currentPPN,"status":"reason unknown"}]});
        logToPage("debug", currentEntry + "PI does not existst. Create new entry in result list.");
      }
    // log pi, ppn and blacklists
      logToConsole(ppnCheckResults);
    }

    // go to the next entry
    if ( increasePointer( ppnSource ) ){
      checkPPNs( ppnSource );
    };

  // ppn was not checked yet
  } else {
    logToPage("debug", currentEntry + "PPN is unknown. Let's check it.");

    let currentURL = "";
    currentURL += "https://ws.gbv.de/suggest/csl2/";
    currentURL += "?query=pica.ppn=" + currentPPN;
    currentURL += "&citationstyle=ieee&language=de";

    $.ajax({
      url: currentURL,
    }).done(function( checkResult ) {
      requestCounter ++;
      let citesData = JSON.parse( checkResult );
      // not cite found
      if ( citesData[1][0] === undefined ) {
        logToPage("debug", currentEntry + "No cite found.");
        // check leading zero
        // check link to cataloge
        // add ppn to blacklist

        if (!ppnCheckResults.PPNBlackList.includes(currentPPN)) {
          ppnCheckResults.PPNBlackList.push(currentPPN);
        }
        // add pi to resultlist
        if (ppnCheckResults.wrongPPNsByPI.some((object) => object.PI === currentPI)) {
          logToPage("debug", currentEntry + "PI exists in result list. append ppn.");
          let key = ppnCheckResults.wrongPPNsByPI.findIndex(object => object.PI === currentPI);
          ppnCheckResults.wrongPPNsByPI[key].PPN.push({"id":currentPPN,"status":"reason unknown"});
        } else {
          ppnCheckResults.wrongPPNsByPI.push({"PI":currentPI,"PPN":[{"id":currentPPN,"status":"reason unknown"}]});
          logToPage("debug", currentEntry + "PI does not existst. Create new entry in result list.");
        }
        // log pi, ppn and blacklists
        logToConsole(ppnCheckResults);

        // go to the next entry
        if ( increasePointer( ppnSource ) ){
          checkPPNs( ppnSource );
        };

      // cite found
      } else {
        // add ppn to whitelist
        if (!ppnCheckResults.PPNWhiteList.includes(currentPPN)) {
          ppnCheckResults.PPNWhiteList.push(currentPPN);
        }
        logToPage("debug", currentEntry + "Cite for this PPN found.");
        if ( increasePointer( ppnSource ) ){
          checkPPNs( ppnSource );
        };
      }
    });

  }
}

function increasePointer( ppnSource ) {
  logToPage("debug", currentEntry + "Increase Pointer.");
  var returnStatus = true;
  var ppnListLength = ppnSource.response.docs[pointer.PI].MD_NLD_LITERATUREQUOTATION.length-1;
  var PIListLength = ppnSource.response.docs.length-1;
  logToConsole(ppnListLength);
  logToConsole(pointer.PPN);
  if ( ppnListLength > pointer.PPN ) {
    logToPage("debug", currentEntry + "Current Object has more PPN.");
    pointer.PPN = pointer.PPN + 1;
  } else {
    logToPage("debug", currentEntry + "Going to the next Object.");
    if ( PIListLength > pointer.PI ) {
      pointer.PI = pointer.PI + 1;
      pointer.PPN = 0;
      logToPage("debug", currentEntry + "Pointer increased.");
      logToConsole(pointer);
    } else {
      logToPage("debug", currentEntry + "Last Object reached.");
      logToPage("result", requestCounter + " request sended.");
      logToPage("result",  JSON.stringify(ppnCheckResults));
      returnStatus = false;
    }
  }
  return returnStatus;
}

function logToPage( channel, output ) {
  var debugElement = $(".debug");
  var resultsElement = $(".results");
  if (channel == "debug") {
    debugElement.prepend("<p>" + output + "</p>");
  }
  if (channel == "result") {
    resultsElement.append("<p>" + output + "</p>");
  }
}

function logToConsole( output ) {
  if (debugMode) {
    console.log(output);
  }
}