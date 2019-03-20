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



var CommonTransport = require( 'logfella-common-transport' ) ;
var fs = require( 'fs' ) ;
var path = require( 'path' ) ;
var Promise = require( 'seventh' ) ;
//var string = require( 'string-kit' ) ;



function ScatteredFilesTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	if ( typeof config.path !== 'string' ) { config.path = __dirname ; }

	// Use color?
	// Actually, color may be useful when using 'tail -f'
	this.color = !! config.color ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
	this.path = config.path ;
	this.streams = {} ;
}

module.exports = ScatteredFilesTransport ;

ScatteredFilesTransport.prototype = Object.create( CommonTransport.prototype ) ;
ScatteredFilesTransport.prototype.constructor = ScatteredFilesTransport ;



ScatteredFilesTransport.prototype.transport = function transport( data , cache ) {
	var realMessage , jobs ;

	realMessage = this.messageFormatter( data , cache ) + '\n' ;

	jobs = [
		[ 'ALL-ALL.log' , realMessage ] ,
		[ data.levelName + '-ALL.log' , realMessage ]
	] ;

	if ( data.domain ) {
		jobs.push( [ 'ALL-' + data.domain + '.log' , realMessage ] ) ;
		jobs.push( [ data.levelName + '-' + data.domain + '.log' , realMessage ] ) ;
	}

	return Promise.every( jobs , job => {
		var [ filename , message ] = job ;

		if ( ! this.streams[ filename ] ) {
			// Should open the writeStream first
			this.streams[ filename ] = fs.createWriteStream( path.join( this.path , filename ) , { flags: 'a' } ) ;
		}

		return new Promise( resolve => {
			this.streams[ filename ].write( message , () => { resolve() ; } ) ;
		} ) ;
	} ) ;
} ;



ScatteredFilesTransport.prototype.shutdown = function shutdown() {
	var k ;
	for ( k in this.streams ) { this.streams[ k ].end() ; delete this.streams[ k ] ; }
	delete this.streams ;
} ;

