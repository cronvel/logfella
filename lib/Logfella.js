/*
	Logfella

	Copyright (c) 2015 - 2022 Cédric Ronvel

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



const Promise = require( 'seventh' ) ;
const string = require( 'string-kit' ) ;
const treeOps = require( 'kung-fig-tree-ops' ) ;
const CommonTransport = require( 'logfella-common-transport' ) ;

var path , os ;
var browserPageTime ;

if ( process.browser ) {
	browserPageTime = Date.now() ;

	if ( process.uptime !== 'function' ) {
		process.uptime = () => Date.now() - browserPageTime ;
	}
}
else {
	path = require( 'path' ) ;
	os = require( 'os' ) ;
}



function Logfella( config ) {
	this.root = this ;
	this.perDomain = null ;
	this.logTransports = [] ;
	this.monTransports = [] ;
	this.app = null ;
	this.pid = null ;
	this.hostname = null ;
	this.minLevel = 3 ;
	this.maxLevel = 7 ;
	this.defaultDomain = 'no-domain' ;
	this.domain = null ;
	this.overrideConsole = false ;
	this.levelArray = defaultLevelArray ;
	this.levelHash = defaultLevelHash ;
	this.mon = { warnings: 0 , errors: 0 } ;
	this.monPeriod = null ;
	this.monStatus = 'stopped' ;

	// Hooks
	this.hook = null ;
	this.monHook = null ;

	// Should be not enumerable (circular)
	Object.defineProperty( this , 'root' , { value: this } ) ;

	if ( ! process.browser ) {
		// unknown case are produced when running REPL
		this.app = path.basename( process.argv[ 1 ] || '(unknown)' ) ;
		this.pid = process.pid ;
		this.hostname = os.hostname() ;
	}

	if ( config ) { this.configure( config ) ; }
}

module.exports = Logfella ;

// Backward compatibility
Logfella.create = ( ... args ) => new Logfella( ... args ) ;

Logfella.prototype.timeFormatter = require( './timeFormatter.js' ) ;
Logfella.prototype.messageFormatter = require( './messageFormatter.js' ) ;



var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' , 'hdebug' ] ,
	defaultAvailableLevels = [] ;



( function() {
	var i , name ;

	var createShortHand = ( level , name_ ) => {
		Logfella.prototype[ name_ ] = function( ... args ) {
			// Early exit, if possible
			if ( ! this.perDomain && ( level < this.minLevel || level > this.maxLevel ) ) { return Promise.resolved ; }
			return this.log( level , ... args ) ;
		} ;
	} ;

	for ( i = 0 ; i < defaultLevelArray.length ; i ++ ) {
		name = defaultLevelArray[ i ] ;
		defaultLevelHash[ name ] = i ;
		defaultAvailableLevels.push( i ) ;
		defaultAvailableLevels.push( name ) ;
		createShortHand( i , name ) ;
	}
} )() ;



// Check if the current level is enable, userland
Logfella.prototype.checkLevel = function( level ) {
	if ( typeof level === 'string' ) {
		level = this.levelHash[ level ] ;
	}

	return level >= this.minLevel && level <= this.maxLevel ;
} ;



Logfella.defineOrConfig = function( name , config ) {
	if ( Logfella[ name ] ) {
		if ( Logfella[ name ] instanceof Logfella ) {
			Logfella[ name ].configure( config ) ;
		}
		else {
			throw new Error( "Logfella: '" + name + "' is reserved" ) ;
		}
	}
	else {
		Logfella[ name ] = new Logfella( config ) ;
	}
} ;



Logfella.prototype.use = function( domain ) {
	// Force a domain
	var logger = Object.create( this , {
		domain: { value: domain , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.useHook = function( hook , monHook ) {
	// Force a hook
	var logger = Object.create( this , {
		hook: { value: hook , enumerable: true } ,
		monHook: { value: monHook , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.setGlobalConfig =
Logfella.prototype.configure = function( config ) {
	var i , iMax ;

	if ( config.app ) { this.app = config.app ; }

	if ( config.minLevel !== undefined ) {
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.levelHash[ config.minLevel ] ; }
	}

	if ( config.maxLevel !== undefined ) {
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.levelHash[ config.maxLevel ] ; }
	}

	if ( config.defaultDomain && typeof config.defaultDomain === 'string' ) { this.defaultDomain = config.defaultDomain ; }

	if ( config.overrideConsole !== undefined ) {
		if ( ! this.overrideConsole !== ! config.overrideConsole ) {
			if ( config.overrideConsole ) { this.replaceConsole() ; }
			else { this.restoreConsole() ; }
		}

		this.overrideConsole = !! config.overrideConsole ;
	}

	if ( config.monPeriod !== undefined ) {
		if ( ! config.monPeriod ) {
			this.monPeriod = null ;
			this.stopMon() ;
		}
		else if ( typeof config.monPeriod === 'number' ) {
			this.monPeriod = config.monPeriod ;
			this.startMon() ;
		}
	}

	if ( config.perDomain ) {
		for ( let k in config.perDomain ) {
			this.setDomainConfig( k , config.perDomain[ k ] ) ;
		}
	}

	if ( Array.isArray( config.transports ) ) {
		this.removeAllTransports() ;

		iMax = config.transports.length ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			this.addTransport( config.transports[ i ].type , config.transports[ i ] ) ;
		}
	}
} ;



Logfella.prototype.disablePerDomainSettings = function() {
	this.perDomain = null ;
} ;



Logfella.prototype.setDomainConfig = function( domain , config ) {
	if ( ! this.perDomain ) { this.perDomain = {} ; }
	if ( ! this.perDomain[ domain ] ) { this.perDomain[ domain ] = {} ; }

	if ( config.minLevel ) {
		this.perDomain[ domain ].minLevel = typeof config.minLevel === 'string' ?
			this.levelHash[ config.minLevel ] :
			config.minLevel ;
	}

	if ( config.maxLevel ) {
		this.perDomain[ domain ].maxLevel = typeof config.maxLevel === 'string' ?
			this.levelHash[ config.maxLevel ] :
			config.maxLevel ;
	}
} ;



// log( level , domain , [code|meta] , formatedMessage , [arg1] , [arg2] , ... )
Logfella.prototype.log = function( level , ... args ) {
	var formatCount , formatedMessage , formatedMessageIndex , type , o , monModifier , perDomain ,
		levelName , domain , meta , code , hookData , messageData , isFormat , stack ;

	// /!\ Any change here should be reflected in .receive()

	if ( typeof level === 'number' ) {
		if ( level >= this.levelArray.length ) { return Promise.resolved ; }
		levelName = this.levelArray[ level ] ;
	}
	else if ( typeof level === 'string' ) {
		levelName = level ;
		level = this.levelHash[ levelName ] ;
		if ( level === undefined ) { return Promise.resolved ; }
	}
	else {
		return Promise.resolved ;
	}

	if ( this.domain ) {
		domain = this.domain ;
		formatedMessageIndex = 0 ;
	}
	else {
		domain = typeof args[ 0 ] === 'string' ? args[ 0 ] : this.defaultDomain ;
		formatedMessageIndex = 1 ;
	}

	// Should be done before early-out
	if ( level >= 4 ) {
		// The user may override and fucked that up, so we ensure we deal with numbers
		if ( level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}

	// Level management should come first for early exit
	if ( this.perDomain && ( perDomain = this.perDomain[ domain ] ) ) {
		// Per-domain filtering
		if (
			level < ( perDomain.minLevel !== undefined ? perDomain.minLevel : this.minLevel ) ||
			level > ( perDomain.maxLevel !== undefined ? perDomain.maxLevel : this.maxLevel )
		) {
			return Promise.resolved ;
		}
	}
	else if ( level < this.minLevel || level > this.maxLevel ) {
		return Promise.resolved ;
	}

	// Check if there is a 'code/meta' argument
	if ( args.length > formatedMessageIndex + 1 ) {
		type = typeof args[ formatedMessageIndex ] ;

		if ( args[ formatedMessageIndex ] && type === 'object' ) {
			// This is a 'meta' argument
			meta = args[ formatedMessageIndex ] ;

			// Extract the 'code' property, if any...
			if ( 'code' in meta ) {
				code = meta.code ;
				delete meta.code ;
			}

			// Extract the 'mon' property, if any...
			if ( 'mon' in meta ) {
				monModifier = meta.mon ;
				delete meta.mon ;
			}

			// Extract the 'hookData' property, if any...
			if ( 'hookData' in meta ) {
				hookData = meta.hookData ;
				delete meta.hookData ;
			}

			formatedMessageIndex ++ ;
		}
		else if ( type === 'number' ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
		else if ( type === 'string' && args[ formatedMessageIndex ].indexOf( '%' ) === -1 ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}

	}

	if ( monModifier && typeof monModifier === 'object' ) {
		treeOps.autoReduce( this.mon , monModifier ) ;
	}

	// Call the mon hook, if any
	if ( this.monHook ) { this.monHook( this.mon ) ; }

	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { return Promise.resolved ; }


	formatedMessage = args[ formatedMessageIndex ] ;

	if ( typeof formatedMessage === 'string' ) {
		// Variable list of arguments
		formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments

		if ( ! formatCount ) {
			messageData = formatedMessage ;
		}
		else {
			messageData = args.slice( formatedMessageIndex , formatedMessageIndex + 1 + formatCount ) ;
			isFormat = true ;
		}
	}
	else {
		messageData = formatedMessage ;
	}

	if ( level === 0 ) {
		// Add a stack trace for 'trace' level
		if ( process.browser ) {
			o = new Error() ;
		}
		else {
			o = {} ;
			Error.captureStackTrace( o , Logfella.prototype.trace ) ;

			if ( o.stack.indexOf( '\n' ) === -1 ) {
				// The Logfella#log have been called instead of Logfella#trace

				// For some reason, Error.captureStackTrace() do not work twice on the same object,
				// even if the 'stack' property is deleted.
				o = {} ;
				Error.captureStackTrace( o , Logfella.prototype.log ) ;
			}
		}

		stack = o.stack ;
	}

	var data = {
		level ,
		levelName ,
		domain ,
		meta ,
		monModifier ,
		code ,
		messageData ,
		isFormat ,
		stack ,
		hookData ,
		time: new Date()
	} ;

	return this.finalizeLog( data ) ;
} ;



Logfella.prototype.finalizeLog = function( data ) {
	var level = data.level ,
		cache = null ;

	// Finalize data
	data.app = this.app ;
	data.uptime = process.uptime() ;
	data.pid = this.pid ;
	data.hostname = this.hostname ;
	data.messageCache = {} ;

	// Call the hook, if any
	if ( this.hook ) { this.hook( data ) ; }

	var eachTransport = transport => {
		if ( level < transport.minLevel || level > transport.maxLevel )  { return Promise.resolved ; }
		return transport.transport( data , cache ) ;
	} ;

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.logTransports.length === 1 ) {
		return eachTransport( this.logTransports[ 0 ] ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.logTransports.map( eachTransport ) ) ;
} ;



// This method is used when receiving log information from a remote Logfella instance (with Bridge transport and a userland transfer method).
Logfella.prototype.receive = function( data ) {
	var level = data.level ;

	// /!\ Any change in .log() should be reflected here.
	// Duplicated code is unavoidable because of all early-out optimization code.

	// Should be done before early-out
	if ( level >= 4 ) {
		// The user may override and fucked that up, so we ensure we deal with numbers
		if ( level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}

	// Level management should come first for early exit
	let perDomain ;
	if ( this.perDomain && ( perDomain = this.perDomain[ data.domain ] ) ) {
		// Per-domain filtering
		if (
			level < ( perDomain.minLevel !== undefined ? perDomain.minLevel : this.minLevel ) ||
			level > ( perDomain.maxLevel !== undefined ? perDomain.maxLevel : this.maxLevel )
		) {
			return Promise.resolved ;
		}
	}
	else if ( level < this.minLevel || level > this.maxLevel ) {
		return Promise.resolved ;
	}

	if ( data.monModifier && typeof data.monModifier === 'object' ) {
		treeOps.autoReduce( this.mon , data.monModifier ) ;
	}

	// Call the mon hook, if any
	if ( this.monHook ) { this.monHook( this.mon ) ; }

	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { return Promise.resolved ; }

	return this.finalizeLog( data ) ;
} ;



Logfella.prototype.startMon = async function() {
	switch ( this.monStatus ) {
		case 'stopping' :
			// We have to wait until it is stopped
			await Promise.resolveTimeout( this.monPeriod ) ;
			return this.startMon() ;
		case 'stopped' :
			// Go!
			break ;
		case 'started' :
			// Already running
			return ;
	}

	if ( this.monStatus !== 'stopped' ) { return ; }
	this.monStatus = 'started' ;

	for ( ;; ) {
		await this.monFrame() ;
		await Promise.resolveTimeout( this.monPeriod ) ;

		switch ( this.monStatus ) {
			case 'stopping' :
				// We can now turn it into 'stopped'
				this.monStatus = 'stopped' ;
				return ;
			case 'stopped' :
				// Already stopped, return... (should never happen)
				return ;
			case 'started' :
				// Still running!
				break ;
		}
	}
} ;



Logfella.prototype.stopMon = function() {
	switch ( this.monStatus ) {
		case 'stopping' :
		case 'stopped' :
			return ;
		case 'started' :
			this.monStatus = 'stopping' ;
	}
} ;



Logfella.prototype.updateMon = function( monModifier ) {
	treeOps.autoReduce( this.mon , monModifier ) ;
} ;



// monFrame()
Logfella.prototype.monFrame = function() {
	if ( ! this.monTransports.length ) { return Promise.resolved ; }

	var cache = null ;

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

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.monTransports.length === 1 ) {
		return this.monTransports[ 0 ].transport( data , cache ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.monTransports.map( transport => transport.transport( data , cache ) ) ) ;
} ;



Logfella.transports = {} ;



Logfella.prototype.addTransport = function( transport , config ) {
	var module_ , role , instance ;

	switch ( config.role ) {
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

	if ( typeof transport === 'string' ) {
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;

		if ( Logfella.transports[ transport ] === undefined && ! process.browser ) {
			try {
				// First try to get core transport
				module_ = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					// Then try to get a module
					module_ = require( 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) ;
				}
				catch ( error_ ) {

					try {
						// Try to require the parent module: useful if Logfella is a devDependecy of a transport stand-alone module,
						// e.g.: unit tests of that transport.
						module_ = require( '../../../package.json' ) ;

						if ( module_.name === 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) {
							module_ = require( '../../../' ) ;
						}
						else {
							// will be catched and throw
							throw null ;
						}
					}
					catch ( error__ ) {
						// Nothing could be loaded...
						// Should a logger log error? or not? That's a good question!!!
						throw new Error( "Logfella: can't load transport: " + transport ) ;
					}
				}
			}

			if ( ! ( module_.prototype instanceof CommonTransport ) ) {
				throw new Error( "Logfella: not an instance of CommonTranport: " + transport ) ;
			}

			Logfella.transports[ transport ] = module_ ;
		}

		transport = Logfella.transports[ transport ] ;
	}

	instance = new transport( this , config ) ;

	this[ role ].push( instance ) ;
} ;



Logfella.prototype.removeAllTransports = function() {
	var i , iMax ;

	for ( i = 0 , iMax = this.logTransports.length ; i < iMax ; i ++ ) { this.logTransports[ i ].shutdown() ; }
	for ( i = 0 , iMax = this.monTransports.length ; i < iMax ; i ++ ) { this.monTransports[ i ].shutdown() ; }

	this.logTransports = [] ;
	this.monTransports = [] ;
} ;



// This method should eventually become cross-platform
Logfella.setStackTraceLimit = function( depth ) {
	Error.stackTraceLimit = depth ;
} ;



var exitHandlersInstalled = false ;

if ( process.browser ) {
	// It does not make sense in browsers...
	Logfella.prototype.installExitHandlers = function() {} ;
}
else {
	Logfella.prototype.installExitHandlers = function() {
		var logger = this.root ;
		var domain = this.domain || 'logfella' ;

		if ( exitHandlersInstalled ) { return ; }
		exitHandlersInstalled = true ;

		process.on( 'asyncExit' , ( code , timeout , callback ) => {
			logger.info( domain , 'The process is about to exit within %ims with code %i...' , timeout , code ).then( callback ) ;
		} ) ;

		process.on( 'exit' , ( code ) => {
			logger.info( domain , 'The process is exiting with code %i...' , code ) ;
		} ) ;

		process.on( 'uncaughtException' , error => {
			if ( process.listenerCount( 'uncaughtException' ) <= 1 ) {
				// We are on our own
				logger.fatal( domain , 'Uncaught exception: %E' , error ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 1 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.fatal( domain , 'Uncaught exception: %E' , error ) ;
			}
		} ) ;

		process.on( 'unhandledRejection' , error => {
			logger.fatal( domain , 'Unhandled promise rejection: %E\n^rUnhandled rejection are ^R^+DEPRECATED^:^r and will end the Node.js process in the future!' , error ) ;
		} ) ;

		process.on( 'SIGINT' , () => {
			if ( process.listenerCount( 'SIGINT' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGINT signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 130 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGINT signal.' ) ;
			}
		} ) ;

		process.on( 'SIGTERM' , () => {
			if ( process.listenerCount( 'SIGTERM' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGTERM signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 143 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGTERM signal.' ) ;
			}
		} ) ;

		process.on( 'SIGHUP' , () => {
			if ( process.listenerCount( 'SIGHUP' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGHUP signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 129 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGHUP signal.' ) ;
			}
		} ) ;
	} ;
}



var consoleBackup = {
	trace: console.trace ,
	log: console.log ,
	info: console.info ,
	warn: console.warn ,
	error: console.error ,
	dir: console.dir
} ;



function consoleReplacement( type , domain , ... args ) {
	var util = require( 'util' ) ;
	var message = string.escape.format( util.format( ... args ) ) ;
	return this[ type ]( domain , message ) ;
}



Logfella.prototype.replaceConsole = function() {
	console.trace = consoleReplacement.bind( this , 'trace' , 'console' ) ;
	console.log = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.info = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.warn = consoleReplacement.bind( this , 'warning' , 'console' ) ;
	console.error = consoleReplacement.bind( this , 'error' , 'console' ) ;
} ;



Logfella.prototype.restoreConsole = function() {
	console.trace = consoleBackup.trace ;
	console.log = consoleBackup.log ;
	console.info = consoleBackup.info ;
	console.warn = consoleBackup.warn ;
	console.error = consoleBackup.error ;
} ;



// Useful for third-party lib to validate the config
Logfella.configSchema = {
	type: 'strictObject' ,
	default: {} ,
	properties: {
		minLevel: { in: defaultAvailableLevels , default: 3 } ,
		maxLevel: { in: defaultAvailableLevels , default: 7 } ,
		defaultDomain: { type: 'string' , default: 'no-domain' } ,
		overrideConsole: { type: 'boolean' , default: false } ,
		monPeriod: { type: 'number' , default: null } ,
		perDomain: {
			type: 'strictObject' ,
			default: null ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 7 }
				}
			}
		} ,
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
					maxLevel: { in: defaultAvailableLevels , default: 7 } ,
					messageFormatter: [ { type: 'function' } , { type: 'string' , optional: true } ] ,
					timeFormatter: [ { type: 'function' } , { type: 'string' , default: 'dateTime' } ] ,
					color: { type: 'boolean' , default: false }
				}
			}
		}
	}
} ;



// Global logger

Logfella.global = new Logfella() ;
Logfella.global.configure( { minLevel: 'trace' } ) ;

if ( process.browser ) {
	Logfella.transports.BrowserConsole = require( './BrowserConsole.transport.js' ) ;
	Logfella.global.addTransport( 'BrowserConsole' , { minLevel: 'trace' } ) ;
	window.Logfella = Logfella ;
}
else {
	Logfella.global.addTransport( 'console' , { minLevel: 'trace' , color: true } ) ;
	//Logfella.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;
}

