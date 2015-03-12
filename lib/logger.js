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
var fs = require( 'fs' ) ;
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



logger.Logger.prototype.log = function log( level , domain , message , completionCallback )
{
	// get the time right now!
	var time = new Date() ;
	var i , length = this.transports.length , levelName ;
	
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
	
	if ( arguments.length < 3 )
	{
		message = domain ;
		domain = undefined ;
	}
	
	if ( typeof domain !== 'string' ) { domain = this.defaultDomain ; }
	
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.transports )
	.using( function( transport , callback ) {
		if ( level < transport.minLevel )  { callback() ; return ; }
		transport.transport( time , level , levelName , domain , message , callback ) ;
	} )
	.exec( completionCallback ) ;
} ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

logger.timeFormatter = {} ;

// Full time formater, with date & time in ms
logger.timeFormatter.dateTimeMs = function dateTimeMs( time )
{
	return time.getUTCFullYear() + '-' + leadingZero( time.getUTCMonth() + 1 ) + '-' + leadingZero( time.getUTCDate() ) +
		' ' + leadingZero( time.getUTCHours() ) + ':' + leadingZero( time.getUTCMinutes() ) + ':' + leadingZero( time.getUTCSeconds() ) +
		'.' + ( time.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
logger.timeFormatter.dateTime = function dateTime( time )
{
	return time.getUTCFullYear() + '-' + leadingZero( time.getUTCMonth() + 1 ) + '-' + leadingZero( time.getUTCDate() ) +
		' ' + leadingZero( time.getUTCHours() ) + ':' + leadingZero( time.getUTCMinutes() ) + ':' + leadingZero( time.getUTCSeconds() ) ;
} ;

// Time in ms
logger.timeFormatter.timeMs = function timeMs( time )
{
	return leadingZero( time.getUTCHours() ) + ':' + leadingZero( time.getUTCMinutes() ) + ':' + leadingZero( time.getUTCSeconds() ) +
		'.' + ( time.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
logger.timeFormatter.time = function time( time )
{
	return leadingZero( time.getUTCHours() ) + ':' + leadingZero( time.getUTCMinutes() ) + ':' + leadingZero( time.getUTCSeconds() ) ;
} ;



logger.Logger.prototype.addTransport = function addTransport( transport , minLevel , config )
{
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		transport = logger.transports[ transport ] ;
	}
	
	if ( typeof transport === 'function' && typeof transport.create === 'function' )
	{
		this.transports.push( transport.create( this , minLevel , config ) ) ;
	}
} ;





			////////////////
			// Transports //
			////////////////



logger.transports = {} ;

// Empty constructor, it is just there to support instanceof operator
logger.transports.Common = function CommonTransport() { throw new Error( "[logger] Cannot create a CommonTransport object directly" ) ; } ;



logger.transports.Common.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( logger.transports.Common.prototype )
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



logger.transports.Common.prototype.init = function init( parentLogger , minLevel , config )
{
	// Arguments management
	if ( typeof minLevel !== 'number' )
	{
		if ( parentLogger.levels[ minLevel ] === undefined ) { return ; }
		minLevel = parentLogger.levels[ minLevel ] ;
	}
	
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	
	Object.defineProperties( this , {
		logger: { value: parentLogger , enumerable: true } ,
		minLevel: { value: minLevel , writable: true , enumerable: true } ,
		timeFormatter: {
			writable: true ,
			enumerable: true ,
			value: typeof config.timeFormatter === 'function' ?
				config.timeFormatter :
				logger.timeFormatter[ config.timeFormatter ] || logger.timeFormatter.time
		}
	} ) ;
} ;




logger.transports.Common.prototype.message = function message( time , level , levelName , domain , message )
{
	var colorCode , levelString , timeString ;
	
	timeString = this.timeFormatter( time ) + ' ' ;
	
	if ( ! domain || typeof domain !== 'string' ) { domainString = '' ; }
	else { domainString = "<" + domain + "> " ; }
	
	// Five letter levelName
	switch ( levelName )
	{
		case 'trace' : levelString = '[TRACE] ' ; break ;
		case 'debug' : levelString = '[DEBUG] ' ; break ;
		case 'verbose' : levelString = '[VERB.] ' ; break ;
		case 'info' : levelString = '[INFO.] ' ; break ;
		case 'warning' : levelString = '[WARN.] ' ; break ;
		case 'error' : levelString = '[ERROR] ' ; break ;
		case 'fatal' : levelString = '[FATAL] ' ; break ;
		default : levelString = '[' + ( levelName + '.    ' ).slice( 0 , 5 ) + '] ' ; break ;
	}
	
	if ( this.color )
	{
		switch ( levelName )
		{
			case 'trace' : colorCode = string.ansi.brightBlack ; break ;
			case 'debug' : colorCode = string.ansi.dim ; break ;
			case 'verbose' : colorCode = string.ansi.blue ; break ;
			case 'info' : colorCode = string.ansi.brightWhite + string.ansi.bold ; break ;
			case 'warning' : colorCode = string.ansi.yellow + string.ansi.bold ; break ;
			case 'error' : colorCode = string.ansi.red + string.ansi.bold ; break ;
			case 'fatal' : colorCode = string.ansi.brightRed + string.ansi.bold ; break ;
			default : colorCode = string.ansi.dim ; break ;
		}
		
		levelString = colorCode + levelString + string.ansi.reset ;
	}
	
	return levelString + timeString + domainString + message ;
} ;




			/* Console transport */



// Empty constructor, it is just there to support instanceof operator
logger.transports.Console = function ConsoleTransport() { throw new Error( "[logger] Cannot create a ConsoleTransport object directly" ) ; } ;

// Inherits from logger.Transport
logger.transports.Console.prototype = Object.create( logger.transports.Common.prototype ) ;
logger.transports.Console.prototype.constructor = logger.transports.Console ;



logger.transports.Console.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( logger.transports.Console.prototype )
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



logger.transports.Console.prototype.init = function create( parentLogger , minLevel , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	// Call parent init()
	logger.transports.Common.prototype.init.call( this , parentLogger , minLevel , config ) ;
	
	
	Object.defineProperties( this , {
		color: { value: config.color ? true : false , writable: true , enumerable: true }
	} ) ;
} ;



logger.transports.Console.prototype.transport = function transport( time , level , levelName , domain , message , callback )
{
	console.log( this.message( time , level , levelName , domain , message ) ) ;
	if ( typeof callback === 'function' ) { callback() ; }
} ;





			/* Async Console transport */



// It looks like it is not possible to stream to stdout in a non-blocking way ATM...

// Empty constructor, it is just there to support instanceof operator
logger.transports.AsyncConsole = function AsyncConsole() { throw new Error( "[logger] Cannot create a Transport.AsyncConsole object directly" ) ; } ;

// Inherits from logger.transports.Console
logger.transports.AsyncConsole.prototype = Object.create( logger.transports.Console.prototype ) ;
logger.transports.AsyncConsole.prototype.constructor = logger.transports.AsyncConsole ;





			/* Files transport */



// Empty constructor, it is just there to support instanceof operator
logger.transports.Files = function Files() { throw new Error( "[logger] Cannot create a Transport.Files object directly" ) ; } ;

// Inherits from logger.transports.Common
logger.transports.Files.prototype = Object.create( logger.transports.Common.prototype ) ;
logger.transports.Files.prototype.constructor = logger.transports.Files ;



logger.transports.Files.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( logger.transports.Files.prototype )
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



logger.transports.Files.prototype.init = function create( parentLogger , minLevel , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' )  config = {} ;
	
	// Call parent init()
	logger.transports.Common.prototype.init.call( this , parentLogger , minLevel , config ) ;
	
	if ( typeof config.path !== 'string' )  config.path = __dirname + '/' ;
	else if ( config.path[ config.path.length - 1 ] !== '/' )  config.path = config.path + '/' ;
	
	Object.defineProperties( this , {
		color: { value: false , enumerable: true } ,	// Never ever use color
		path: { value: config.path , enumerable: true } ,
		streams: { value: {} , enumerable: true }
	} ) ;
} ;



logger.transports.Files.prototype.transport = function transport( time , level , levelName , domain , message , completionCallback )
{
	var self = this , realMessage , jobs ;
	
	realMessage = this.message( time , level , levelName , domain , message ) + '\n' ;
	
	jobs = [
		[ 'ALL-ALL.log' , realMessage ] ,
		[ levelName + '-ALL.log' , realMessage ]
	] ;
	
	if ( domain )
	{
		jobs.push( [ 'ALL-' + domain + '.log' , realMessage ] ) ;
		jobs.push( [ levelName + '-' + domain + '.log' , realMessage ] ) ;
	}
	
	async.parallel( jobs )
	.using( function( filename , message , jobCallback ) {
		self.appendToFile( filename , message , jobCallback ) ;
	} )
	.exec( completionCallback ) ;
} ;



logger.transports.Files.prototype.appendToFile = function appendToFile( filename , message , callback )
{
	if ( ! this.streams[ filename ] )
	{
		// Should open the writeStream first
		this.streams[ filename ] = fs.createWriteStream( this.path + filename , { flags: 'a' } ) ;
	}
	
	this.streams[ filename ].write( message , callback ) ;
} ;






logger.common = logger.Logger.create() ;
logger.common.setGlobalLevel( 'trace' ) ;
logger.common.addTransport( 'console' , 'info' , { color: true } ) ;
logger.common.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;

