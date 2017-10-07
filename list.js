var defaultOptions = {
    trigger: null,
    wrap: '',
    caseSensitive: true
};

function noopd(data) { return data; }

function SuggestionList(options) {
    // validate options
    if (options && !options.suggestions) {
        options = {
            suggestions: options
        };
    }

    options = $.extend(true, {}, defaultOptions, options || {});

    if(!options.suggestions) {
        throw new Error('AutoSuggest: missing required parameter, suggestions');
    }

    if (typeof options.suggestions === 'function') {
        this.getSuggestions = options.suggestions;
    } else if(options.suggestions.constructor === Array || typeof options.suggestions === 'string') {
        options.suggestions = [].concat(options.suggestions);
        this.getSuggestions = function(keyword, callback) {
            var match = new RegExp(keyword, !options.caseSensitive ? 'i' : '');
            callback (
                options.suggestions.filter(function(suggestion) {
                    return match.test(suggestion);
                })
            );
        };
    }

    var trigger = options.trigger;
    var wrap = options.wrap;
    var beforeAppend = options.beforeAppend;
    var beforeShow = options.beforeShow;

    if(trigger && typeof trigger !== 'string') {
        throw new Error('AutoSuggest: trigger should be a string');
    }
    if(wrap && typeof wrap !== 'string') {
        throw new Error('AutoSuggest: wrap should be a string');
    }
    if(beforeAppend && typeof beforeAppend !== 'function') {
        throw new Error('AutoSuggest: beforeAppend should be a function');
    }
    if(beforeShow && typeof beforeShow !== 'function') {
        throw new Error('AutoSuggest: beforeShow should be a function');
    }

    var escapedTrigger,preRegex;
    if(trigger) {
        escapedTrigger = '\\' + trigger.split('').join('\\');
        this.regex = new RegExp('(?:^|[^' + escapedTrigger + ']+)' + escapedTrigger + '(\\S*)$');
    } else {
        this.regex = new RegExp('(?:^|\\s+)(\\S+)$');
    }

    this.getOutput = beforeAppend || noopd;
    if(wrap) {
        var _oldGetOutput = this.getOutput;
        this.getOutput = function(value) {
            if(value.beforeAppend && typeof value.beforeAppend === 'function') {
                value = value.beforeAppend(value);
            } else {
                value = _oldGetOutput(value);
            }
            return value + wrap;
        }
    }

    this.getVisual = beforeShow || noopd;
}
