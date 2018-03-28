import Context from "./context";
import { ErrDuplicateDeclard } from "./error";
import { Kind, ScopeType } from "./type";
import { Var } from "./var";

export class Scope {
  // the scope have invasive property
  public invasive: boolean = false;

  public redeclare: boolean = false; // !!dangerous

  // is the top level scope
  public isTopLevel: boolean = false;

  // scope context
  public context: Context;

  public isolated: boolean = true; // 孤立的作用域，表示在BlockStatement不会创建新的作用域，默认会创建

  // the scope fork from witch scope
  public origin: Scope | null = null;

  // scope var
  private content: { [key: string]: Var<any> } = {};

  constructor(
    public readonly type: ScopeType,
    public parent: Scope | null,
    label?: string
  ) {
    this.context = new Context();
  }

  public setInvasive(invasive: boolean) {
    this.invasive = invasive;
    return this;
  }

  public setContext(context: Context) {
    this.context = context;
    for (const name in context) {
      if (context.hasOwnProperty(name)) {
        // here should use $var
        this.var(name, context[name]);
      }
    }
  }

  public raw(): { [key: string]: any } {
    const map = {};
    for (const varName in this.content) {
      if (this.content.hasOwnProperty(varName)) {
        const val = this.content[varName];
        map[varName] = val.value;
      }
    }
    return map;
  }

  public locate(varName: string): Scope | null {
    if (this.hasOwnBinding(varName)) {
      return this;
    } else {
      if (this.parent) {
        return this.parent.locate.call(this.parent, varName);
      } else {
        return null;
      }
    }
  }

  public hasBinding(varName: string): Var<any> | void {
    if (this.content.hasOwnProperty(varName)) {
      return this.content[varName];
    } else if (this.parent) {
      return this.parent.hasBinding(varName);
    } else {
      return undefined;
    }
  }

  public hasOwnBinding(varName: string): Var<any> | void {
    if (this.content.hasOwnProperty(varName)) {
      return this.content[varName];
    } else {
      return undefined;
    }
  }

  get global(): Scope {
    if (this.parent) {
      return this.parent.global;
    } else {
      return this;
    }
  }

  public let(varName: string, value: any): boolean {
    const $var = this.content[varName];
    if (!$var) {
      this.content[varName] = new Var("let", varName, value, this);
      return true;
    } else if (this.redeclare) {
      this.content[varName] = new Var("let", varName, value, this);
      return true;
    } else {
      throw ErrDuplicateDeclard(varName);
    }
  }

  public const(varName: string, value: any): boolean {
    const $var = this.content[varName];
    if (!$var) {
      this.content[varName] = new Var("const", varName, value, this);
      return true;
    } else if (this.redeclare) {
      this.content[varName] = new Var("const", varName, value, this);
      return true;
    } else {
      throw ErrDuplicateDeclard(varName);
    }
  }

  public var(varName: string, value: any): boolean {
    // tslint:disable-next-line
    let scope: Scope = this;

    while (
      scope.parent !== null &&
      (scope.type !== "function" && scope.type !== "constructor")
    ) {
      scope = scope.parent;
    }

    const $var = scope.content[varName];
    if ($var) {
      if ($var.kind !== "var") {
        // only cover var with var, not const and let
        throw ErrDuplicateDeclard(varName);
      } else {
        if (this.isTopLevel && this.context[varName]) {
          // top level context can not be cover
          // here we do nothing
        } else {
          this.content[varName] = new Var("var", varName, value, this);
        }
      }
    } else {
      this.content[varName] = new Var("var", varName, value, this);
    }
    return true;
  }

  public del(varName: string) {
    delete this.content[varName];
  }

  public declare(kind: Kind, rawName: string, value: any): boolean {
    return {
      const: () => this.const(rawName, value),
      let: () => this.let(rawName, value),
      var: () => this.var(rawName, value)
    }[kind]();
  }
  public createChild(type: ScopeType, label?: string): Scope {
    return new Scope(type, this, label);
  }
  public fork(type?: ScopeType): Scope {
    // forks a new scope
    const siblingScope = new Scope(type || this.type, null);

    // copy the properties
    siblingScope.invasive = this.invasive;
    siblingScope.redeclare = this.redeclare;
    siblingScope.isTopLevel = this.isTopLevel;
    siblingScope.context = this.context;
    siblingScope.parent = this.parent;
    siblingScope.origin = this;

    // copy the vars
    for (const varName in this.content) {
      if (this.content.hasOwnProperty(varName)) {
        const $var = this.content[varName];
        siblingScope.declare($var.kind, $var.name, $var.value);
      }
    }
    return siblingScope;
  }
}