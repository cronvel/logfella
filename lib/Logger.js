/*
	The Cedric's Swiss Knife (CSK) - CSK logger toolbox

	Copyright (c) 2015 Cédric Ronvel 
	
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



// Modules
var async = require( 'async-kit' ) ;
var string = require( 'string-kit' ) ;






			////////////
			// Logger //
			////////////



// Empty constructor, it is just there to support instanceof operator
function Logger() { throw new Error( "[logger] Cannot create a Logger object directly" ) ; } ;
module.exports = Logger ;


var i ;

var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' ] ;

for ( i = 0 ; i < defaultLevelArray.length ; i ++ ) { defaultLevelHash[ defaultLevelArray[ i ] ] = i ; }





Logger.create = function create()
{
	var newLogger = Object.create( Logger.prototype , {
		transports: { value: [] , writable: true , enumerable: true } ,
		globalLevel: { value: 3 , writable: true , enumerable: true } ,
		defaultDomain: { value: '' , writable: true , enumerable: true } ,
		levelArray: { value: defaultLevelArray , writable: true , enumerable: true } ,
		levelHash: { value: defaultLevelHash , writable: true , enumerable: true }
	} ) ;
	
	
	Object.defineProperties( newLogger , {
		trace: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.trace ) } ,
		debug: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.debug ) } ,
		verbose: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.verbose ) } ,
		info: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.info ) } ,
		warning: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.warning ) } ,
		error: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.error ) } ,
		fatal: { value: Logger.prototype.log.bind( newLogger , newLogger.levelHash.fatal ) }
	} ) ;
	
	return newLogger ;
} ;



Logger.prototype.setGlobalLevel = function setGlobalLevel( level )
{
	if ( typeof level === 'number' ) { this.globalLevel = level ; }
	else if ( typeof level === 'string' ) { this.globalLevel = this.levelHash[ level ] ; }
} ;



Logger.prototype.setDefaultDomain = function setDefaultDomain( domain )
{
	if ( typeof domain === 'string' ) { this.defaultDomain = domain ; }
} ;



// log( level , domain , formatedMessage , [arg1] , [arg2] , ... , [callback] )
Logger.prototype.log = function log( level , domain , formatedMessage )
{
	var formatCount , callback , data = {} ;
	
	
	
	// Level management should come first for early exit
	if ( typeof level === 'number' )
	{
		data.level = level ;
		data.levelName = this.levelArray[ level ] ;
	}
	else if ( typeof level === 'string' )
	{
		data.levelName = level ;
		data.level = this.levelHash[ level ] ;
	}
	
	if ( data.level === undefined || data.level < this.globalLevel || data.levelName === undefined ) { return ; }
	
	
	
	data.time = new Date() ;
	data.domain = typeof domain === 'string' ? domain : this.defaultDomain ;
	
	// Variable list of arguments
	formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments
	callback = arguments[ 3 + formatCount ] ;	// if any, the callback comes after formated arguments
	
	// Get the real message
	if ( ! formatCount ) { data.message = formatedMessage ; }
	else { data.message = string.format.apply( undefined , Array.prototype.slice.call( arguments , 2 , 3 + formatCount ) ) ; }
	
	
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.transports )
	.using( function( transport , usingCallback ) {
		if ( level < transport.minLevel )  { usingCallback() ; return ; }
		transport.transport( data , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



Logger.transports = {} ;

Logger.prototype.addTransport = function addTransport( transport , minLevel , config )
{
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		
		if ( Logger.transports[ transport ] === undefined )
		{
			Logger.transports[ transport ] = require( './' + transport + '.transport.js' ) ;
		}
		
		transport = Logger.transports[ transport ] ;
	}
	
	if ( typeof transport === 'function' && typeof transport.create === 'function' )
	{
		this.transports.push( transport.create( this , minLevel , config ) ) ;
	}
} ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

Logger.prototype.timeFormatter = {} ;

// Full time formater, with date & time in ms
Logger.prototype.timeFormatter.dateTimeMs = function dateTimeMs( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
Logger.prototype.timeFormatter.dateTime = function dateTime( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
Logger.prototype.timeFormatter.timeMs = function timeMs( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
Logger.prototype.timeFormatter.time = function time( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;





// Global logger

Logger.global = Logger.create() ;
Logger.global.setGlobalLevel( 'trace' ) ;
Logger.global.addTransport( 'console' , 'info' , { color: true } ) ;
//Logger.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;


