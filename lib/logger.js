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



// Create the object
var logger = {} ;

// Export it!
module.exports = logger ;





			////////////
			// Logger //
			////////////



// Empty constructor, it is just there to support instanceof operator
logger.Logger = function Logger() { throw new Error( "[logger] Cannot create a Logger object directly" ) ; } ;



logger.Logger.create = function create()
{
	var newLogger = Object.create( logger.Logger.prototype , {
		transports: { value: [] , writable: true , enumerable: true } ,
		globalLevel: { value: 3 , writable: true , enumerable: true } ,
		defaultDomain: { value: '' , writable: true , enumerable: true } ,
		levels: {
			enumerable: true ,
			value: Object.create( Object , {
				trace: { value: 0 , enumerable: true } ,
				debug: { value: 1 , enumerable: true } ,
				verbose: { value: 2 , enumerable: true } ,
				info: { value: 3 , enumerable: true } ,
				warning: { value: 4 , enumerable: true } ,
				error: { value: 5 , enumerable: true } ,
				fatal: { value: 6 , enumerable: true }
			} )
		}
	} ) ;
	
	Object.defineProperties( newLogger , {
		trace: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.trace ) } ,
		debug: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.debug ) } ,
		verbose: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.verbose ) } ,
		info: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.info ) } ,
		warning: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.warning ) } ,
		error: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.error ) } ,
		fatal: { value: logger.Logger.prototype.log.bind( newLogger , newLogger.levels.fatal ) }
	} ) ;
	
	return newLogger ;
} ;



logger.Logger.prototype.setGlobalLevel = function setGlobalLevel( level )
{
	if ( this.levels[ level ] !== undefined ) { this.globalLevel = this.levels[ level ] ; }
} ;



logger.Logger.prototype.setDefaultDomain = function setDefaultDomain( domain )
{
	if ( typeof domain === 'string' ) { this.defaultDomain = domain ; }
} ;



// log( level , domain , formatedMessage , [arg1] , [arg2] , ... , [callback] )
logger.Logger.prototype.log = function log( level , domain , formatedMessage )
{
	// get the time right now!
	var formatCount , message , callback , levelName , time = new Date() ;
	
	// Arguments management
	if ( typeof level === 'number' )
	{
		levelName = Object.keys( this.levels )[ level ] ;
	}
	else
	{
		if ( this.levels[ level ] === undefined ) { return ; }
		levelName = level ;
		level = this.levels[ level ] ;
	}
	
	if ( level < this.globalLevel ) { return ; }
	
	if ( typeof domain !== 'string' ) { domain = this.defaultDomain ; }
	
	// Variable list of arguments
	formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments
	callback = arguments[ 3 + formatCount ] ;	// if any, the callback comes after formated arguments
	
	// Get the real message
	if ( ! formatCount ) { message = formatedMessage ; }
	else { message = string.format.apply( undefined , Array.prototype.slice.call( arguments , 2 , 3 + formatCount ) ) ; }
	
	
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.transports )
	.using( function( transport , usingCallback ) {
		if ( level < transport.minLevel )  { usingCallback() ; return ; }
		transport.transport( time , level , levelName , domain , message , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



logger.transports = {} ;

logger.Logger.prototype.addTransport = function addTransport( transport , minLevel , config )
{
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		
		if ( logger.transports[ transport ] === undefined )
		{
			logger.transports[ transport ] = require( './' + transport + '.transport.js' ) ;
		}
		
		transport = logger.transports[ transport ] ;
	}
	
	if ( typeof transport === 'function' && typeof transport.create === 'function' )
	{
		this.transports.push( transport.create( this , minLevel , config ) ) ;
	}
} ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

logger.Logger.prototype.timeFormatter = {} ;

// Full time formater, with date & time in ms
logger.Logger.prototype.timeFormatter.dateTimeMs = function dateTimeMs( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
logger.Logger.prototype.timeFormatter.dateTime = function dateTime( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
logger.Logger.prototype.timeFormatter.timeMs = function timeMs( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
logger.Logger.prototype.timeFormatter.time = function time( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;





// Global logger

logger.global = logger.Logger.create() ;
logger.global.setGlobalLevel( 'trace' ) ;
logger.global.addTransport( 'console' , 'info' , { color: true } ) ;
logger.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;


