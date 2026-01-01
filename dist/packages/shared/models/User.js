export var UserType;
(function (UserType) {
    UserType[UserType["Host"] = 0] = "Host";
    UserType[UserType["Player"] = 1] = "Player";
    UserType[UserType["Unknown"] = 2] = "Unknown";
})(UserType || (UserType = {}));
export class User {
    get id() {
        return this._id;
    }
    get type() {
        return this._type;
    }
    get created() {
        return this._created;
    }
    get updated() {
        return this._updated;
    }
    get isConnected() {
        return this._isConnected;
    }
    set isConnected(val) {
        this._isConnected = val;
        this._updated = new Date();
    }
    _id;
    _type;
    _created = new Date();
    _updated = new Date();
    _isConnected = true;
    constructor(id, type) {
        this._id = id;
        this._type = type;
    }
    ping() {
        this._updated = new Date();
    }
}
