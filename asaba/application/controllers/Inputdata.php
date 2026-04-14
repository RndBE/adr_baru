<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Inputdata extends CI_Controller {
function __construct()
	{
		parent :: __construct();
		$this->load->model('m_inputdata');
		$this->load->library('csvimport');
	}



function index()
{

	$data['konten']='konten/back/v_inputdata';
	$this->load->view('template_admin/site_back',$data);
}

 function importcsv() {
        $data['error'] = '';    //initialize image upload error array to empty

        $this->load->library('upload');
        $config['upload_path'] = './upload_csv/';
        $config['allowed_types'] = 'csv|txt';
        $config['max_size'] = 1000;
        $this->upload->initialize($config);
        


        // If upload failed, display error
        if (!$this->upload->do_upload()) {
            $data['error'] = "File CSV gagal di upload";
            $data['konten']='konten/back/v_inputdata';
			$this->load->view('template_admin/site_back',$data);
        } 
        else {
            
            $file_data = $this->upload->data();
            $file_path =  './upload_csv/'.$file_data['file_name'];
            
            if ($this->csvimport->get_array($file_path)) {
                $csv_array = $this->csvimport->get_array($file_path);

                foreach ($csv_array as $row) {
                    $insert_data = array(
                        'logger_id'=>$row['id_alat'],
                        'waktu'=>$row['tanggal'].' '.$row['jam'],
                        'sensor1'=>$row['sensor1'],
                        'sensor2'=>$row['sensor2'],
                        'sensor3'=>$row['sensor3'],
                        'sensor4'=>$row['sensor4'],
                         'sensor5'=>$row['sensor5'],
                        'sensor6'=>$row['sensor6'],
                        'sensor7'=>$row['sensor7'],
                        'sensor8'=>$row['sensor8'],
                         'sensor9'=>$row['sensor9'],
                        'sensor10'=>$row['sensor10'],
                        'sensor11'=>$row['sensor11'],
                        'sensor12'=>$row['sensor12'],
                         'sensor13'=>$row['sensor13'],
                        'sensor14'=>$row['sensor14'],
                        'sensor15'=>$row['sensor15'],
                        'sensor16'=>$row['sensor16'],

                    );
                    $this->m_inputdata->insert_csv($insert_data);
                }
                $this->session->set_flashdata('success', 'Data CSV Sukses di import');
                redirect('inputdata');
                //echo "<pre>"; print_r($insert_data);
            } 
            else 
            
                $data['konten']='konten/back/v_inputdata';
				$this->load->view('template_admin/site_back',$data);
            }
            
        } 



}