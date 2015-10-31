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

var CommonTransport = require( './Common.transport.js' ) ;

var os = require( 'os' ) ;
var util = require( 'util' ) ;





// Empty constructor, it is just there to support instanceof operator
function Logfella() { throw new Error( "[logger] Cannot create a Logfella object directly" ) ; }
module.exports = Logfella ;



var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' ] ,
	defaultAvailableLevels = [] ;

Logfella.create = function create( config )
{
	var logger = Object.create( Logfella.prototype , {
		transports: { value: [] , writable: true , enumerable: true } ,
		pid: { value: process.pid , writable: true , enumerable: true } ,
		hostname: { value: os.hostname() , writable: true , enumerable: true } ,
		minLevel: { value: 3 , writable: true , enumerable: true } ,
		maxLevel: { value: 6 , writable: true , enumerable: true } ,
		defaultDomain: { value: 'no-domain' , writable: true , enumerable: true } ,
		overrideConsole: { value: false , writable: true , enumerable: true } ,
		levelArray: { value: defaultLevelArray , writable: true , enumerable: true } ,
		levelHash: { value: defaultLevelHash , writable: true , enumerable: true }
	} ) ;
	
	if ( config ) { logger.setGlobalConfig( config ) ; }
	
	return logger ;
} ;



( function() {
	var i , name ;
	
	function createShortHand( level , name )
	{
		Logfella.prototype[ name ] = function() {
			// Fast exit, if possible
			if ( level < this.minLevel || level > this.maxLevel ) { return ; }
			return this.log.apply( this , [ level ].concat( Array.prototype.slice.call( arguments ) ) ) ;
		} ;
	}
	
	for ( i = 0 ; i < defaultLevelArray.length ; i ++ )
	{
		name = defaultLevelArray[ i ] ;
		defaultLevelHash[ name ] = i ;
		defaultAvailableLevels.push( i ) ;
		defaultAvailableLevels.push( name ) ;
		createShortHand( i , name ) ;
	}
} )() ;



Logfella.prototype.use = function use( domain )
{
	// Force a domain
	var logger = Object.create( this , {
		domain: { value: domain , enumerable: true }
	} ) ;
	
	return logger ;
} ;



Logfella.prototype.setGlobalConfig = function setGlobalConfig( config )
{
	var i , iMax ;
	
	if ( config.minLevel !== undefined )
	{
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.levelHash[ config.minLevel ] ; }
	}
	
	if ( config.maxLevel !== undefined )
	{
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.levelHash[ config.maxLevel ] ; }
	}
	
	if ( config.defaultDomain && typeof config.defaultDomain === 'string' ) { this.defaultDomain = config.defaultDomain ; }
	
	if ( config.overrideConsole !== undefined )
	{
		config.overrideConsole = !! config.overrideConsole ;
		
		if ( this.overrideConsole !== config.overrideConsole )
		{
			if ( config.overrideConsole ) { this.replaceConsole() ; }
			else { this.restoreConsole() ; }
		}
		
		this.overrideConsole = config.overrideConsole ;
	}
	
	if ( Array.isArray( config.transports ) )
	{
		this.removeAllTransports() ;
		
		iMax = config.transports.length ;
		
		for ( i = 0 ; i < iMax ; i ++ )
		{
			this.addTransport( config.transports[ i ].type , config.transports[ i ] ) ;
		}
	}
} ;



// log( level , domain , [code|meta] , formatedMessage , [arg1] , [arg2] , ... , [callback] )
Logfella.prototype.log = function log( level )
{
	var formatCount , callback , formatedMessage , formatedMessageIndex , data , type ;
	
	
	// Level management should come first for early exit
	if ( typeof level === 'number' )
	{
		// Fast exit
		if ( level < this.minLevel || level > this.maxLevel || level >= this.levelArray.length ) { return ; }
		
		data = {
			level: level ,
			levelName: this.levelArray[ level ]
		} ;
	}
	else if ( typeof level === 'string' )
	{
		data = {
			levelName: level ,
			level: this.levelHash[ level ]
		} ;
		
		// Fast exit
		if ( data.level === undefined || data.level < this.minLevel || data.level > this.maxLevel ) { return ; }
	}
	else
	{
		return ;
	}
	
	
	data.time = new Date() ;
	
	if ( this.domain )
	{
		data.domain = this.domain ;
		formatedMessageIndex = 1 ;
	}
	else
	{
		data.domain = typeof arguments[ 1 ] === 'string' ? arguments[ 1 ] : this.defaultDomain ;
		formatedMessageIndex = 2 ;
	}
	
	// Check if there is a 'code/meta' argument
	if ( arguments.length > formatedMessageIndex + 1 && typeof arguments[ formatedMessageIndex + 1 ] !== 'function' )
	{
		type = typeof arguments[ formatedMessageIndex ] ;
		
		if ( arguments[ formatedMessageIndex ] && type === 'object' )
		{
			// This is a 'meta' argument
			data.meta = arguments[ formatedMessageIndex ] ;
			
			// Extract the 'code' property, if any...
			if ( 'code' in data.meta )
			{
				data.code = data.meta.code ;
				delete data.meta.code ;
			}
			formatedMessageIndex ++ ;
		}
		else if ( type === 'number' )
		{
			// This is a 'code' argument
			data.code = arguments[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
		else if ( type === 'string' && arguments[ formatedMessageIndex ].indexOf( '%' ) === -1 )
		{
			// This is a 'code' argument
			data.code = arguments[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
		
	}
	
	formatedMessage = arguments[ formatedMessageIndex ] ;
	
	if ( typeof formatedMessage === 'string' )
	{
		// Variable list of arguments
		formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments
		callback = arguments[ formatedMessageIndex + 1 + formatCount ] ;	// if any, the callback comes after formated arguments
		
		if ( ! formatCount )
		{
			data.messageData = formatedMessage ;
		}
		else
		{
			data.messageData = Array.prototype.slice.call( arguments , formatedMessageIndex , formatedMessageIndex + 1 + formatCount ) ;
			data.messageData.isFormat = true ;
		}
	}
	else
	{
		data.messageData = formatedMessage ;
		callback = arguments[ formatedMessageIndex + 1 ] ;
	}
	
	data.pid = this.pid ;
	data.hostname = this.hostname ;
	
	data.messageCache = {} ;
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.transports )
	.using( function( transport , usingCallback ) {
		if ( level < transport.minLevel || level > transport.maxLevel )  { usingCallback() ; return ; }
		transport.transport( data , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



Logfella.transports = {} ;



Logfella.prototype.addTransport = function addTransport( transport , config )
{
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		
		if ( Logfella.transports[ transport ] === undefined )
		{
			try {
				Logfella.transports[ transport ] = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					Logfella.transports[ transport ] = require( 'logger-kit-' + transport + '-transport' ) ;
				}
				catch ( error ) {
					// Should a logger log error? or not? That's a good question!!!
				}
			}
		}
		
		transport = Logfella.transports[ transport ] ;
	}
	
	if ( transport.prototype instanceof CommonTransport )
	{
		this.transports.push( transport.create( this , config ) ) ;
	}
} ;

Logfella.prototype.removeAllTransports = function removeAllTransports() { this.transports = [] ; } ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

Logfella.prototype.timeFormatter = {} ;

// Full time formater, with date & time in ms
Logfella.prototype.timeFormatter.dateTimeMs = function dateTimeMs( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
Logfella.prototype.timeFormatter.dateTime = function dateTime( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
Logfella.prototype.timeFormatter.timeMs = function timeMs( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
Logfella.prototype.timeFormatter.time = function time( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;



Logfella.configSchema = {
	type: 'strictObject' ,
	default: {} ,
	properties: {
		minLevel: { in: defaultAvailableLevels , default: 3 } ,
		maxLevel: { in: defaultAvailableLevels , default: 6 } ,
		defaultDomain: { type: 'string' , default: 'no-domain' } ,
		transports: {
			type: 'array' ,
			default: [] ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					type: { type: 'string' } ,
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 6 } ,
					timeFormatter: [ { type: 'function' } , { type: 'string' , default: 'time' } ] ,
					color: { type: 'boolean' , default: false }
				}
			}
		}
	}
} ;



var exitHandlersInstalled = false ;

Logfella.prototype.installExitHandlers = function installExitHandlers()
{
	var self = this ;
	
	if ( exitHandlersInstalled ) { return ; }
	exitHandlersInstalled = true ;
	
	process.on( 'asyncExit' , function( code , timeout , callback ) {
		self.info( 'The process is about to exit within %ims with code %i...' , timeout , code , callback ) ;
	} ) ;
	
	process.on( 'exit' , function( code ) {
		self.info( 'The process is exiting with code %i...' , code ) ;
	} ) ;
	
	process.on( 'uncaughtException' , function( error ) {
		if ( process.listenerCount( 'uncaughtException' ) <= 1 )
		{
			// We are on our own
			self.fatal( 'Uncaught exception: %E' , error , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 1 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			self.fatal( 'Uncaught exception: %E' , error ) ;
		}
	} ) ;
	
	process.on( 'SIGINT' , function( error ) {
		if ( process.listenerCount( 'SIGINT' ) <= 1 )
		{
			// We are on our own
			self.info( 'Received a SIGINT signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 130 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			self.info( 'Received a SIGINT signal.' ) ;
		}
	} ) ;
	
	process.on( 'SIGTERM' , function( error ) {
		if ( process.listenerCount( 'SIGTERM' ) <= 1 )
		{
			// We are on our own
			self.info( 'Received a SIGTERM signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 143 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			self.info( 'Received a SIGTERM signal.' ) ;
		}
	} ) ;
	
	process.on( 'SIGHUP' , function( error ) {
		if ( process.listenerCount( 'SIGHUP' ) <= 1 )
		{
			// We are on our own
			self.info( 'Received a SIGHUP signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 129 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			self.info( 'Received a SIGHUP signal.' ) ;
		}
	} ) ;
} ;



var consoleBackup = {
	trace: console.trace ,
	log: console.log ,
	info: console.info ,
	warn: console.warn ,
	error: console.error ,
	dir: console.dir
} ;



Logfella.prototype.replaceConsole = function replaceConsole()
{
	console.trace = consoleReplacement.bind( this , 'trace' , 'console' ) ;
	console.log = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.info = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.warn = consoleReplacement.bind( this , 'warning' , 'console' ) ;
	console.error = consoleReplacement.bind( this , 'error' , 'console' ) ;
} ;



function consoleReplacement( type , domain )
{
	var message = string.escape.format(
		util.format.apply( undefined , Array.prototype.slice.call( arguments , 2 ) )
	) ;
	
	return this[ type ].apply( this , [ domain , message ] ) ;
}



Logfella.prototype.restoreConsole = function restoreConsole()
{
	console.trace = consoleBackup.trace ;
	console.log = consoleBackup.log ;
	console.info = consoleBackup.info ;
	console.warn = consoleBackup.warn ;
	console.error = consoleBackup.error ;
} ;



// Global logger

Logfella.global = Logfella.create() ;
Logfella.global.setGlobalConfig( { minLevel: 'trace' } ) ;
Logfella.global.addTransport( 'console' , { minLevel: 'trace' , color: true } ) ;
//Logfella.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;


