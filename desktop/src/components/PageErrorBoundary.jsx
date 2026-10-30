import { Component } from 'react';
import i18n from 'i18next';

export default class PageErrorBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.error('[Page]', error); }
    render() {
        if (!this.state.failed) return this.props.children;
        return <div className="alert alert-danger m-3" role="alert">
            <h2 className="h5">{i18n.t('This page could not be displayed.')}</h2>
            <p>{i18n.t('Try again or open another section from the menu.')}</p>
            <button className="btn btn-outline-danger" onClick={() => this.setState({ failed: false })}>{i18n.t('Retry')}</button>
        </div>;
    }
}
