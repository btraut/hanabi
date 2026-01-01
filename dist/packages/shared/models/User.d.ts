export declare enum UserType {
    Host = 0,
    Player = 1,
    Unknown = 2
}
export declare class User {
    get id(): string;
    get type(): UserType;
    get created(): Date;
    get updated(): Date;
    get isConnected(): boolean;
    set isConnected(val: boolean);
    private _id;
    private _type;
    private _created;
    private _updated;
    private _isConnected;
    constructor(id: string, type: UserType);
    ping(): void;
}
//# sourceMappingURL=User.d.ts.map