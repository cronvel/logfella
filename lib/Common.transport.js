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



// Empty constructor, it is just there to support instanceof operator
function CommonTransport() { throw new Error( "[logger] Cannot create a CommonTransport object directly" ) ; }
module.exports = CommonTransport ;



CommonTransport.create = function create( logger , config )
{
	var transport = Object.create( CommonTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



CommonTransport.prototype.init = function init( logger , config )
{
	Object.defineProperties( this , {
		logger: { value: logger , enumerable: true } ,
		monitoring: { value: false , writable: true , enumerable: true } ,
		minLevel: { value: 0 , writable: true , enumerable: true } ,
		maxLevel: { value: 6 , writable: true , enumerable: true } ,
		messageFormatter: { value: logger.messageFormatter.text , writable: true , enumerable: true } ,
		timeFormatter: { value: logger.timeFormatter.time , writable: true , enumerable: true }
	} ) ;
	
	if ( config ) { this.setConfig( config ) ; }
} ;



CommonTransport.prototype.setConfig = function setConfig( config )
{
	if ( config.monitoring !== undefined ) { this.monitoring = !! config.monitoring ; }
	
	if ( config.minLevel !== undefined )
	{
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.logger.levelHash[ config.minLevel ] ; }
	}
	
	if ( config.maxLevel !== undefined )
	{
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.logger.levelHash[ config.maxLevel ] ; }
	}
	
	if ( config.messageFormatter )
	{
		if ( typeof config.messageFormatter === 'function' ) { this.messageFormatter = config.messageFormatter ; }
		else { this.messageFormatter = this.logger.messageFormatter[ config.messageFormatter ] ; }
	}
	
	if ( config.timeFormatter )
	{
		if ( typeof config.timeFormatter === 'function' ) { this.timeFormatter = config.timeFormatter ; }
		else { this.timeFormatter = this.logger.timeFormatter[ config.timeFormatter ] ; }
	}
} ;


