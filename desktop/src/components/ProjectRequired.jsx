import { useTranslation } from 'react-i18next';

export default function ProjectRequired({ shell }) {
    const { t } = useTranslation();
    return <div className="text-center py-5 px-3">
        <i className="bi bi-folder2-open fs-1 text-primary d-block mb-3" aria-hidden="true"></i>
        <h2 className="h5">{t('Select a project')}</h2>
        <p className="text-muted mx-auto" style={{ maxWidth: 420 }}>{t('Choose a project from the bar above, or open the project list to create one.')}</p>
        <button className="btn btn-primary" onClick={() => shell.navigate('menu')}>{t('Open project list')}</button>
    </div>;
}
