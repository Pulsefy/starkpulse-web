import { getDictionary } from '@/lib/getDictionary';

export default async function TestPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-600">
          🌍 Internationalization Test
        </h1>
        
        <div className="space-y-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">{dict.welcome}</h2>
            <p className="text-gray-600">Current locale: <strong>{locale}</strong></p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded">
              <strong>Home:</strong> {dict.home}
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <strong>Dashboard:</strong> {dict.dashboard}
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <strong>News:</strong> {dict.news}
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <strong>Portfolio:</strong> {dict.portfolio}
            </div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-lg">{dict.test}</p>
          </div>
          
          <div className="flex justify-center gap-4">
            <a 
              href="/en/test" 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              English
            </a>
            <a 
              href="/fr/test" 
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Français
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 