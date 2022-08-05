/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const CommonTransport = require( 'logfella-common-transport' ) ;
const noop = function() {} ;

/*
	This transport is used to send the log into another a Logfella instance of another application part,
	e.g.: sending log from the renderer process to the main process on an Electron application.

	* config `object` where:
		* send `function` the handler used to send to a remote Logfella instance
*/

function BridgeTransport( logger , config = {} ) {
	this.send = config.send || noop ;
}

BridgeTransport.prototype = Object.create( CommonTransport.prototype ) ;
BridgeTransport.prototype.constructor = BridgeTransport ;

module.exports = BridgeTransport ;



BridgeTransport.prototype.transport = async function( data ) {
	var bridgeData = {
		level: data.level ,
		levelName: data.levelName ,
		domain: data.domain ,
		meta: data.meta ,
		code: data.code ,
		messageData: data.messageData ,
		isFormat: data.isFormat ,
		stack: data.stack ,
		hookData: data.hookData ,
		time: data.time
	} ;

	return this.send( bridgeData ) ;
} ;

