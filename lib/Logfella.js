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

"use strict" ;



// Modules
var async = require( 'async-kit' ) ;
var string = require( 'string-kit' ) ;
var kungFig = require( 'kung-fig' ) ;

var CommonTransport = require( 'logfella-common-transport' ) ;

var path = require( 'path' ) ;
var os = require( 'os' ) ;
var util = require( 'util' ) ;





// Empty constructor, it is just there to support instanceof operator
function Logfella() { throw new Error( "[logger] Cannot create a Logfella object directly" ) ; }
module.exports = Logfella ;



Logfella.prototype.timeFormatter = require( './timeFormatter.js' ) ;
Logfella.prototype.messageFormatter = require( './messageFormatter.js' ) ;



function noop() {}



var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' ] ,
	defaultAvailableLevels = [] ;



Logfella.create = function create( config )
{
	var logger = Object.create( Logfella.prototype , {
		logTransports: { value: [] , writable: true , enumerable: true } ,
		monTransports: { value: [] , writable: true , enumerable: true } ,
		app: { value: path.basename( process.argv[ 1 ] ) , writable: true , enumerable: true } ,
		pid: { value: process.pid , writable: true , enumerable: true } ,
		hostname: { value: os.hostname() , writable: true , enumerable: true } ,
		minLevel: { value: 3 , writable: true , enumerable: true } ,
		maxLevel: { value: 6 , writable: true , enumerable: true } ,
		defaultDomain: { value: 'no-domain' , writable: true , enumerable: true } ,
		overrideConsole: { value: false , writable: true , enumerable: true } ,
		levelArray: { value: defaultLevelArray , writable: true , enumerable: true } ,
		levelHash: { value: defaultLevelHash , writable: true , enumerable: true } ,
		mon: { value: { warnings: 0 , errors: 0 } , writable: true , enumerable: true } ,
		monPeriod: { value: null , writable: true , enumerable: true } ,
	} ) ;
	
	Object.defineProperty( logger , 'root' , { value: logger } ) ;
	
	if ( config ) { logger.setGlobalConfig( config ) ; }
	
	return logger ;
} ;



( function() {
	var i , name ;
	
	function createShortHand( level , name )
	{
		Logfella.prototype[ name ] = function() {
			
			var callback ;
			
			// Fast exit, if possible
			if ( level < this.minLevel || level > this.maxLevel )
			{
				callback = arguments[ arguments.length - 1 ] ;
				if ( typeof callback === 'function' ) { callback() ; }
				return ;
			}
			
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
	
	if ( config.app ) { this.app = config.app ; }
	
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
	
	if ( config.monPeriod !== undefined )
	{
		if ( ! config.monPeriod )
		{
			this.monPeriod = null ;
			this.stopMon() ;
		}
		else if ( typeof config.monPeriod === 'number' )
		{
			this.monPeriod = config.monPeriod ;
			this.startMon() ;
		}
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



Logfella.prototype.startMon = function startMon()
{
	var self = this ;
	
	if ( this.monTimer ) { return ; }
	
	this.monTimer = setTimeout( function() {
			
			self.monTimer = null ;
			self.monFrame( function() {
				self.startMon() ;
			} ) ;
		} ,
		
		this.monPeriod
	) ;
} ;



Logfella.prototype.stopMon = function stopMon()
{
	if ( this.monTimer )
	{
		clearTimeout( this.monTimer ) ;
		this.monTimer = null ;
	}
} ;



Logfella.prototype.updateMon = function updateMon( monModifier )
{
	kungFig.autoReduce( this.mon , monModifier ) ;
} ;	



// log( level , domain , [code|meta] , formatedMessage , [arg1] , [arg2] , ... , [callback] )
Logfella.prototype.log = function log( level )
{
	var callback , formatCount , formatedMessage , formatedMessageIndex , data , type , o , monModifier , cache = {} ;
	
	callback = arguments[ arguments.length - 1 ] ;
	if ( typeof callback !== 'function' ) { callback = noop ; }
	
	
	// Level management should come first for early exit
	if ( typeof level === 'number' )
	{
		// Fast exit
		if ( level < this.minLevel || level > this.maxLevel || level >= this.levelArray.length ) { callback() ; return ; }
		
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
		if ( data.level === undefined || data.level < this.minLevel || data.level > this.maxLevel ) { callback() ; return ; }
	}
	else
	{
		callback() ;
		return ;
	}
	
	
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
			
			// Extract the 'mon' property, if any...
			if ( 'mon' in data.meta )
			{
				monModifier = data.meta.mon ;
				delete data.meta.mon ;
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
	
	if ( data.level >= 4 )
	{
		// The user may override fucked up that, so we ensure we deal with numbers
		if ( data.level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}
	
	if ( monModifier && typeof monModifier === 'object' )
	{
		kungFig.autoReduce( this.mon , monModifier ) ;
	}
	
	
	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { callback() ; return ; }
	
	
	formatedMessage = arguments[ formatedMessageIndex ] ;
	
	if ( typeof formatedMessage === 'string' )
	{
		// Variable list of arguments
		formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments
		
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
	}
	
	if ( data.level === 0 && ! data.stack )
	{
		// Add a stack trace for 'trace' level
		
		o = {} ;
		Error.captureStackTrace( o , Logfella.prototype.trace ) ;
		
		if ( o.stack.indexOf( '\n' ) === -1 )
		{
			// The Logfella#log have been called instead of Logfella#trace
			
			// For some reason, Error.captureStackTrace() do not work twice on the same object,
			// even if the 'stack' property is deleted.
			o = {} ;
			Error.captureStackTrace( o , Logfella.prototype.log ) ;
		}
		
		data.stack = o.stack ;
	}
	
	data.app = this.app ;
	data.time = new Date() ;
	data.uptime = process.uptime() ;
	data.pid = this.pid ;
	data.hostname = this.hostname ;
	data.messageCache = {} ;
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.logTransports )
	.using( function( transport , usingCallback ) {
		if ( level < transport.minLevel || level > transport.maxLevel )  { usingCallback() ; return ; }
		transport.transport( data , cache , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



// monFrame( [callback] )
Logfella.prototype.monFrame = function monFrame( callback )
{
	if ( ! callback ) { callback = noop ; }
	
	// If there is no transport, skip now...
	if ( ! this.monTransports.length ) { callback() ; return ; }
	
	var cache = {} ;
	
	var data = {
		level: null ,
		levelName: 'mon' ,
		app: this.app ,
		domain: this.domain || 'mon' ,
		time: new Date() ,
		uptime: process.uptime() ,
		pid: this.pid ,
		hostname: this.hostname ,
		mon: this.mon
	} ;
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.monTransports )
	.using( function( transport , usingCallback ) {
		//if ( ! transport.monitoring ) { usingCallback() ; return ; }
		transport.transport( data , cache , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



Logfella.transports = {} ;



Logfella.prototype.addTransport = function addTransport( transport , config )
{
	var module_ , role , instance ;
	
	switch ( config.role )
	{
		case 'mon' :
			role = 'monTransports' ;
			break ;
		case 'log' :
			role = 'logTransports' ;
			break ;
		default :
			role = 'logTransports' ;
			break ;
	}
	
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		
		if ( Logfella.transports[ transport ] === undefined )
		{
			try {
				// First try to get core transport
				module_ = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					// Then try to get a module
					module_ = require( 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) ;
				}
				catch ( error ) {
					
					try {
						// Try to require the parent module: useful if Logfella is a devDependecy of a transport stand-alone module,
						// e.g.: unit tests of that transport.
						
						//console.log( "\n\n\n>>>>>>>>>>>>>>\nChecking parent to find the transport:" , transport , "\n>>>>>>>>>>>\n\n" ) ;
						module_ = require( '../../../package.json' ) ;
						
						if ( module_.name === 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' )
						{
							//console.log( "\n\n\n>>>>>>>>>>>>>>\nParent match!\n>>>>>>>>>>>\n\n" ) ;
							module_ = require( '../../../' ) ;
						}
						else
						{
							//console.log( "\n\n\n>>>>>>>>>>>>>>\nParent mismatch...\n>>>>>>>>>>>\n\n" ) ;
							return ;
						}
					}
					catch ( error ) {
						// Nothing could be loaded...
						// Should a logger log error? or not? That's a good question!!!
						
						//console.log( "\n\n\n>>>>>>>>>>>>>>\nCan't find transport:" , transport , "\n>>>>>>>>>>>\n\n" ) ;
						return ;
					}
				}
			}
			
			if (
				module_.prototype instanceof CommonTransport ||
				( typeof module_.create === 'function' && typeof module_.prototype.transport === 'function' )
			)
			{
				Logfella.transports[ transport ] = module_ ;
			}
			else
			{ 
				//console.log( "\n\n\n>>>>>>>>>>>>>>\nCan't find transport:" , transport , "\n>>>>>>>>>>>\n\n" ) ;
				return ;
			}
		}
		
		transport = Logfella.transports[ transport ] ;
	}
	
	try {
		instance = transport.create( this , config ) ;
	}
	catch ( error ) {
		// What should be done here? Nothing?
		// Can't really log: the logger is probably about to be configured, and not all transport may be ready yet...
		return ;
	}
	
	this[ role ].push( instance ) ;
} ;



Logfella.prototype.removeAllTransports = function removeAllTransports()
{
	var i , iMax ;
	
	for ( i = 0 , iMax = this.logTransports.length ; i < iMax ; i ++ ) { this.logTransports[ i ].shutdown() ; }
	for ( i = 0 , iMax = this.monTransports.length ; i < iMax ; i ++ ) { this.monTransports[ i ].shutdown() ; }
	
	this.logTransports = [] ;
	this.monTransports = [] ;
} ;



Logfella.configSchema = {
	type: 'strictObject' ,
	default: {} ,
	properties: {
		minLevel: { in: defaultAvailableLevels , default: 3 } ,
		maxLevel: { in: defaultAvailableLevels , default: 6 } ,
		defaultDomain: { type: 'string' , default: 'no-domain' } ,
		overrideConsole: { type: 'boolean' , default: false } ,
		monPeriod: { type: 'number' , default: null } ,
		transports: {
			type: 'array' ,
			default: [] ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					type: { type: 'string' } ,
					role: { in: [ 'log' , 'mon' ] , default: 'log' } ,
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 6 } ,
					messageFormatter: [ { type: 'function' } , { type: 'string' , optional: true } ] ,
					timeFormatter: [ { type: 'function' } , { type: 'string' , default: 'dateTime' } ] ,
					color: { type: 'boolean' , default: false }
				}
			}
		}
	}
} ;



var exitHandlersInstalled = false ;

Logfella.prototype.installExitHandlers = function installExitHandlers()
{
	var logger = this.root ;
	var domain = this.domain || 'logfella' ;
	
	if ( exitHandlersInstalled ) { return ; }
	exitHandlersInstalled = true ;
	
	process.on( 'asyncExit' , function( code , timeout , callback ) {
		logger.info( domain , 'The process is about to exit within %ims with code %i...' , timeout , code , callback ) ;
	} ) ;
	
	process.on( 'exit' , function( code ) {
		logger.info( domain , 'The process is exiting with code %i...' , code ) ;
	} ) ;
	
	process.on( 'uncaughtException' , function( error ) {
		if ( process.listenerCount( 'uncaughtException' ) <= 1 )
		{
			// We are on our own
			logger.fatal( domain , 'Uncaught exception: %E' , error , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 1 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			logger.fatal( domain , 'Uncaught exception: %E' , error ) ;
		}
	} ) ;
	
	process.on( 'SIGINT' , function( error ) {
		if ( process.listenerCount( 'SIGINT' ) <= 1 )
		{
			// We are on our own
			logger.info( domain , 'Received a SIGINT signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 130 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			logger.info( domain , 'Received a SIGINT signal.' ) ;
		}
	} ) ;
	
	process.on( 'SIGTERM' , function( error ) {
		if ( process.listenerCount( 'SIGTERM' ) <= 1 )
		{
			// We are on our own
			logger.info( domain , 'Received a SIGTERM signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 143 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			logger.info( domain , 'Received a SIGTERM signal.' ) ;
		}
	} ) ;
	
	process.on( 'SIGHUP' , function( error ) {
		if ( process.listenerCount( 'SIGHUP' ) <= 1 )
		{
			// We are on our own
			logger.info( domain , 'Received a SIGHUP signal.' , function() {
				// All underlying transports have finished, we can exit safely without losing logs...
				async.exit( 129 ) ;
			} ) ;
		}
		else
		{
			// Another handler should have done something about that failure
			logger.info( domain , 'Received a SIGHUP signal.' ) ;
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


